import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { checkCommitFiles, parseLaneTrailer, parseLanesConfig } from '../core/lanes.js';

const execFileAsync = promisify(execFile);
// core.quotepath=false keeps non-ASCII names readable in git's output.
const git = async (cwd: string, ...args: string[]) => (await execFileAsync('git', ['-c', 'core.quotepath=false', ...args], { cwd, maxBuffer: 64 * 1024 * 1024 })).stdout;

export interface LaneCheckResult {
  checked: number;
  /** Commits with no `Lane:` trailer: reported, never failed (humans commit too). */
  untagged: string[];
  /** Commits not checked: the oldest commit of a shallow clone, whose parent is missing. */
  skipped: string[];
  /** One fix-it message per violation, prefixed with the short commit hash. */
  problems: string[];
}

const RECORD = '\u001e';

/** Checks every commit in `range` (default: the last 50 commits) against `.ai/lanes.json`. */
export async function runCheckLanes(dir: string, range?: string): Promise<LaneCheckResult> {
  const text = await readFile(path.join(dir, '.ai', 'lanes.json'), 'utf8').catch(() => undefined);
  if (text === undefined) throw new Error('No .ai/lanes.json here. Create one with `loop init --lanes a,b,c`.');
  const { config, errors } = parseLanesConfig(text);
  if (!config) throw new Error(`.ai/lanes.json is invalid:\n- ${errors.join('\n- ')}`);

  if (!range && !(await git(dir, 'rev-parse', '--verify', '--quiet', 'HEAD').then(() => true, () => false))) {
    return { checked: 0, untagged: [], skipped: [], problems: [] };
  }
  const log = await git(dir, 'log', '--no-merges', `--format=${RECORD}%H%n%B`, ...(range ? [range] : ['-n', '50'])).catch((error: unknown) => {
    throw new Error(`git could not read ${range ?? 'the history'}: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}. Check the range (for example origin/main..HEAD).`);
  });
  const result: LaneCheckResult = { checked: 0, untagged: [], skipped: [], problems: [] };
  const shallow = (await git(dir, 'rev-parse', '--is-shallow-repository')).trim() === 'true';
  for (const record of log.split(RECORD).filter((r) => r.trim() !== '')) {
    const [hash = '', ...body] = record.split('\n');
    const short = hash.slice(0, 7);
    result.checked++;
    const lane = parseLaneTrailer(body.join('\n'));
    if (!lane) {
      result.untagged.push(short);
      continue;
    }
    // Without its parent, a shallow clone's oldest commit would look like it added every file.
    if (shallow && (await git(dir, 'rev-list', '--parents', '-n', '1', hash)).trim().split(' ').length === 1) {
      result.skipped.push(short);
      continue;
    }
    const files = (await git(dir, 'diff-tree', '-z', '--no-commit-id', '--name-only', '-r', '--root', hash)).split('\0').filter(Boolean);
    for (const violation of checkCommitFiles(config, lane, files)) result.problems.push(`${short} (Lane: ${lane}): ${violation.message}`);
  }
  return result;
}

export function formatLaneCheck(result: LaneCheckResult): string {
  const lines = [`Checked ${result.checked} commit(s).`];
  if (result.checked === 0) lines.push('Nothing to check: no commits in the range (or no commits yet). If you passed --range, is it right (for example origin/main..HEAD)?');
  if (result.skipped.length > 0) lines.push(`${result.skipped.length} skipped because this is a shallow clone (${result.skipped.join(', ')}). Use fetch-depth: 0 to check them.`);
  if (result.untagged.length > 0) lines.push(`${result.untagged.length} without a Lane: trailer (not an error): ${result.untagged.join(', ')}`);
  if (result.problems.length === 0) lines.push('All lane-tagged commits stayed in their lane.');
  else lines.push(...result.problems.map((p) => `FAIL ${p}`));
  return lines.join('\n');
}
