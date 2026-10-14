import { execFile } from 'node:child_process';
import { access, appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { parseLanesConfig } from '../core/lanes.js';
import { classifyRunSlots, missedRun, type ClassifiedSlot, type RunOutcome } from '../core/parse/outcomes.js';
import { formatRunEntry, parseRunLog, runLogPath, type RunEntry } from '../core/parse/runs.js';
import { parseSchedule, SCHEDULE_FILE } from '../core/parse/schedule.js';

const execFileAsync = promisify(execFile);

export interface LogRunOptions {
  units?: string[];
  passed?: number;
  failed?: number;
  pushed: boolean;
  triggers?: number;
  session?: string;
  note?: string;
  now?: Date;
}

async function laneNames(dir: string): Promise<{ names: string[]; crons: Map<string, string> }> {
  const text = await readFile(path.join(dir, '.ai', 'lanes.json'), 'utf8').catch(() => undefined);
  if (text === undefined) throw new Error('No .ai/lanes.json here. Create one with `loop init --lanes a,b,c`.');
  const { config, errors } = parseLanesConfig(text);
  if (!config) throw new Error(`.ai/lanes.json is invalid:\n- ${errors.join('\n- ')}`);
  return { names: config.lanes.map((l) => l.name), crons: new Map(config.lanes.flatMap((l) => (l.cron ? [[l.name, l.cron] as const] : []))) };
}

/** `loop runs log`: appends one line to the lane's own runs.jsonl. The caller commits it with its last commit. */
export async function logRun(dir: string, lane: string, options: LogRunOptions): Promise<RunEntry> {
  const { names } = await laneNames(dir);
  if (!names.includes(lane)) throw new Error(`No lane "${lane}". Lanes here: ${names.join(', ')}.`);
  if ((options.passed === undefined) !== (options.failed === undefined)) throw new Error('Pass --passed and --failed together.');
  if (options.triggers !== undefined && (!Number.isInteger(options.triggers) || options.triggers < 0)) throw new Error('--triggers must be a whole number, 0 or more.');
  for (const n of [options.passed, options.failed]) if (n !== undefined && (!Number.isInteger(n) || n < 0)) throw new Error('--passed and --failed must be whole numbers, 0 or more.');
  const entry: RunEntry = {
    at: (options.now ?? new Date()).toISOString(),
    lane,
    ...(options.session && { session: options.session }),
    units: options.units ?? [],
    ...(options.passed !== undefined && options.failed !== undefined && { tests: { passed: options.passed, failed: options.failed } }),
    pushed: options.pushed,
    ...(options.triggers !== undefined && { triggers: options.triggers }),
    ...(options.note && { note: options.note.replace(/\s+/g, ' ').trim() }),
  };
  const file = path.join(dir, ...runLogPath(lane).split('/'));
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, formatRunEntry(entry));
  return entry;
}

export interface LaneRuns {
  lane: string;
  cron?: string;
  entries: RunEntry[];
  slots: ClassifiedSlot[];
  /** Due scheduled runs in a row, newest first, with no log line and no commit (not-due and paused slots do not count). */
  missedInARow: number;
}

export interface RunsReport {
  from: string;
  to: string;
  lanes: LaneRuns[];
  /** Nothing has run for 6 h although runs were due: one warning instead of a list of misses. */
  routinesLookOff: boolean;
  paused: boolean;
}

/** Commit times carrying `Lane: <lane>` since `since`; empty when git cannot say (no repo, no commits). */
async function laneCommitTimes(dir: string, lane: string, since: Date): Promise<Date[]> {
  try {
    const { stdout } = await execFileAsync('git', ['log', `--since=${since.toISOString()}`, '--format=%cI%x09%(trailers:key=Lane,valueonly,separator=%x2C)'], { cwd: dir });
    return stdout.split('\n').flatMap((line) => {
      const [time, trailer] = line.split('\t');
      return time && trailer?.trim() === lane ? [new Date(time)] : [];
    });
  } catch {
    return [];
  }
}

const exists = (dir: string, rel: string) => access(path.join(dir, ...rel.split('/'))).then(() => true, () => false);

/** `loop runs`: each lane's logged runs plus what happened at each scheduled slot in the window (see classifyRunSlots). */
export async function readRuns(dir: string, options: { hours?: number; now?: Date } = {}): Promise<RunsReport> {
  const now = options.now ?? new Date();
  const from = new Date(now.getTime() - (options.hours ?? 24) * 3_600_000);
  const { names, crons } = await laneNames(dir);
  const runs = new Map<string, RunEntry[]>();
  const commits = new Map<string, Date[]>();
  const laneDone = new Set<string>();
  for (const lane of names) {
    runs.set(lane, parseRunLog(await readFile(path.join(dir, ...runLogPath(lane).split('/')), 'utf8').catch(() => '')));
    commits.set(lane, await laneCommitTimes(dir, lane, from));
    if ((await exists(dir, `.ai/lanes/${lane}/DONE.md`)) || (await exists(dir, `.ai/lanes/${lane}/BLOCKED.md`))) laneDone.add(lane);
  }
  const paused = await exists(dir, '.ai/PAUSED');
  const classified = classifyRunSlots({
    lanes: names.map((name) => ({ name, ...(crons.get(name) && { cron: crons.get(name) as string }) })),
    runs,
    schedule: parseSchedule(await readFile(path.join(dir, ...SCHEDULE_FILE.split('/')), 'utf8').catch(() => '')),
    paused,
    rootDone: (await exists(dir, 'DONE.md')) || (await exists(dir, 'BLOCKED.md')),
    laneDone,
    now,
    from,
    commits,
  });
  const lanes: LaneRuns[] = classified.lanes.map(({ lane, slots }) => ({
    lane,
    ...(crons.get(lane) && { cron: crons.get(lane) as string }),
    entries: (runs.get(lane) ?? []).filter((e) => new Date(e.at) > from),
    slots,
    missedInARow: missedRun(slots),
  }));
  return { from: from.toISOString(), to: now.toISOString(), lanes, routinesLookOff: classified.routinesLookOff, paused };
}

const LABEL: Record<RunOutcome, string> = {
  worked: 'worked',
  idle: 'ran, nothing to do',
  'tests-failed': 'tests failed',
  'not-due': 'not due (schedule.json)',
  running: 'likely running',
  missed: 'no run recorded (usage limit or failed start)',
  paused: 'paused',
  done: 'nothing expected (done)',
};
const stamp = (iso: string) => iso.slice(0, 16).replace('T', ' ');

export function formatRuns(report: RunsReport): string {
  const out: string[] = [`Runs ${stamp(report.from)} to ${stamp(report.to)} UTC`];
  if (report.routinesLookOff) out.push('', '! Routines look off: nothing has run for 6 hours although runs were due. Check the routines and your plan\'s usage limit.');
  for (const l of report.lanes) {
    out.push('', `${l.lane}${l.cron ? ` (cron ${l.cron})` : ''}${l.missedInARow >= 3 ? `  ! ${l.missedInARow} scheduled runs in a row left no trace: check your plan's usage limit` : ''}`);
    if (l.slots.length === 0 && l.entries.length === 0) out.push('  nothing logged');
    for (const s of l.slots) {
      const e = s.entry;
      out.push(`  ${stamp(s.slot)}  ${LABEL[s.kind]}${e ? `  ${e.units.length} unit${e.units.length === 1 ? '' : 's'}${e.tests ? `, tests ${e.tests.passed} passed ${e.tests.failed} failed` : ''}${e.note ? `  ${e.note}` : ''}` : ''}`);
    }
  }
  return out.join('\n');
}
