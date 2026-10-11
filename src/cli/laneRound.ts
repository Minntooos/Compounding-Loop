import { execFile } from 'node:child_process';
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { parseLanesConfig } from '../core/lanes.js';
import { planLaneRound, type RoundChange, type RoundPlan } from '../core/laneRound.js';
import { FALLBACK_LANE_TEMPLATES } from '../core/lanesInit.js';
import { CONTROL_LANE } from '../core/lanes.js';
import { loadLaneTemplates } from './lanesInit.js';

const execFileAsync = promisify(execFile);
const git = (cwd: string, ...args: string[]) => execFileAsync('git', args, { cwd });
const read = (file: string) => readFile(file, 'utf8').catch(() => undefined);
const names = (dir: string) => readdir(dir).catch(() => [] as string[]);

export interface LaneRoundOptions {
  briefFile: string;
  dryRun: boolean;
  /** Commit the changes with `Lane: control` (default true; the next-round workflow commits itself and passes false). */
  commit?: boolean;
  now?: Date;
}

export interface LaneRoundResult extends RoundPlan {
  committed: boolean;
}

export const isLanedRepo = (dir: string) => stat(path.join(dir, '.ai', 'lanes.json')).then(() => true, () => false);

/** `loop next-round --brief <file>` for a laned repo. */
export async function runLaneRound(dir: string, options: LaneRoundOptions): Promise<LaneRoundResult> {
  const brief = await read(path.resolve(options.briefFile));
  if (brief === undefined || brief.trim() === '') throw new Error(`Brief file ${options.briefFile} is missing or empty. Write the next round's brief there first.`);
  const configText = await read(path.join(dir, '.ai', 'lanes.json'));
  if (configText === undefined) throw new Error('No .ai/lanes.json here, so --brief has no lanes to reset. Run `loop init --lanes a,b,c` first, or use `loop next-round` without --brief.');
  const { config, errors } = parseLanesConfig(configText);
  if (!config) throw new Error(`.ai/lanes.json is invalid:\n- ${errors.join('\n- ')}`);
  const ideaText = await read(path.join(dir, 'IDEA.md'));
  if (ideaText === undefined) throw new Error('No IDEA.md here: the brief goes at its top.');

  const files: string[] = [];
  if (await stat(path.join(dir, 'DONE.md')).then(() => true, () => false)) files.push('DONE.md');
  for (const n of await names(path.join(dir, '.ai'))) files.push(`.ai/${n}`);
  const laneTasks: Record<string, string | undefined> = {};
  for (const lane of config.lanes) {
    for (const n of await names(path.join(dir, '.ai', 'lanes', lane.name))) files.push(`.ai/lanes/${lane.name}/${n}`);
    laneTasks[lane.name] = await read(path.join(dir, '.ai', 'lanes', lane.name, 'task.md'));
  }
  const rel = path.relative(dir, path.resolve(options.briefFile));
  const inRepo = !rel.startsWith('..') && !path.isAbsolute(rel);
  const plan = planLaneRound({
    brief,
    now: options.now ?? new Date(),
    ideaText,
    ...(await read(path.join(dir, '.ai', 'control-room.md')).then((t) => (t === undefined ? {} : { controlRoomText: t }))),
    lanes: config.lanes,
    files,
    laneTasks,
    taskTemplate: (await loadLaneTemplates().then((t) => t.templates.task, () => FALLBACK_LANE_TEMPLATES.task)),
    ...(inRepo && { briefPath: rel.split(path.sep).join('/') }),
  });
  if (options.dryRun) return { ...plan, committed: false };

  const touched: string[] = [];
  for (const change of plan.changes) {
    await apply(dir, change);
    touched.push(...(change.kind === 'move' ? [change.from, change.to] : [change.path]));
  }
  let committed = false;
  if (options.commit !== false) {
    await git(dir, 'add', '-A', '--', ...touched);
    await git(dir, 'commit', '-qm', `Start round ${plan.round}\n\nLane: ${CONTROL_LANE}`);
    committed = true;
  }
  return { ...plan, committed };
}

async function apply(dir: string, change: RoundChange): Promise<void> {
  const abs = (p: string) => path.join(dir, ...p.split('/'));
  if (change.kind === 'write') {
    await mkdir(path.dirname(abs(change.path)), { recursive: true });
    await writeFile(abs(change.path), change.content);
  } else if (change.kind === 'move') await rename(abs(change.from), abs(change.to));
  else await rm(abs(change.path), { force: true });
}

export function formatLaneRound(result: LaneRoundResult, dryRun: boolean): string {
  const lines = [`Brief score ${result.brief.score}/100${result.brief.gaps.length ? `; missing: ${result.brief.gaps.map((g) => g.message).join(' ')}` : ''}`, `${dryRun ? 'Would start' : 'Started'} round ${result.round}:`];
  for (const c of result.changes) lines.push(`  ${c.kind.padEnd(6)} ${c.kind === 'move' ? `${c.from} -> ${c.to}` : c.path}`);
  if (result.blockedLanes.length) lines.push(`Warning: BLOCKED.md still stands in ${result.blockedLanes.join(', ')}; those lanes stay stopped until \`loop answer\`.`);
  if (!dryRun) lines.push(result.committed ? 'Committed with Lane: control. Push to start the lanes.' : 'Not committed (--no-commit).');
  return lines.join('\n');
}
