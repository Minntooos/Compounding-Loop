import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { parseLanesConfig } from '../core/lanes.js';
import { parseRunLog, runLogPath, type RunEntry } from '../core/parse/runs.js';
import { shipCheck, type ShipCheck, type ShipFacts } from '../core/shipCheck.js';

const execFileAsync = promisify(execFile);
const read = (file: string) => readFile(file, 'utf8').catch(() => undefined);
const git = async (dir: string, ...args: string[]) => (await execFileAsync('git', args, { cwd: dir })).stdout;

/** Newest test result: the latest run-log line that carries one, else `.ai/last-test.json`. */
async function latestTests(dir: string): Promise<ShipFacts['tests']> {
  const configText = await read(path.join(dir, '.ai', 'lanes.json'));
  const lanes = configText === undefined ? [] : (parseLanesConfig(configText).config?.lanes ?? []);
  const entries: RunEntry[] = [];
  for (const lane of lanes) entries.push(...parseRunLog((await read(path.join(dir, ...runLogPath(lane.name).split('/')))) ?? ''));
  const newest = entries.filter((e) => e.tests).sort((a, b) => b.at.localeCompare(a.at))[0];
  if (newest?.tests) return { ...newest.tests, at: newest.at };
  try {
    const record = JSON.parse((await read(path.join(dir, '.ai', 'last-test.json'))) ?? '') as { passed?: unknown; failed?: unknown; at?: unknown };
    if (typeof record.passed === 'number' && typeof record.failed === 'number') return { passed: record.passed, failed: record.failed, ...(typeof record.at === 'string' && { at: record.at }) };
  } catch {
    // no usable result
  }
  return undefined;
}

/** `loop ship-check`: gathers the facts from disk and git, then runs the pure checklist. */
export async function runShipCheck(dir: string): Promise<ShipCheck> {
  const pkg = JSON.parse((await read(path.join(dir, 'package.json'))) ?? 'null') as { version?: unknown } | null;
  if (typeof pkg?.version !== 'string') throw new Error('No package.json with a "version" here: ship-check needs it for the CHANGELOG and tag checks.');
  const [doneText, changelogText, tags, status, tests] = await Promise.all([
    read(path.join(dir, 'DONE.md')),
    read(path.join(dir, 'CHANGELOG.md')),
    git(dir, 'tag', '-l', `v${pkg.version}`).catch(() => ''),
    git(dir, 'status', '--porcelain').catch(() => 'not a git repo'),
    latestTests(dir),
  ]);
  return shipCheck({
    version: pkg.version,
    ...(doneText !== undefined && { doneText }),
    ...(changelogText !== undefined && { changelogText }),
    tagExists: tags.trim() !== '',
    treeClean: status.trim() === '',
    ...(tests && { tests }),
  });
}

export function formatShipCheck(result: ShipCheck): string {
  const lines = result.items.map((i) => `${i.ok ? '✓' : '✗'} ${i.label}: ${i.detail}`);
  if (result.openFindings.length) lines.push('', 'Open findings in DONE.md:', ...result.openFindings.map((f) => `  - ${f}`));
  lines.push('', result.ready ? 'Ready to ship.' : 'Not ready to ship.');
  return lines.join('\n');
}
