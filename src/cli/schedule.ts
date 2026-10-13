import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CONTROL_LANE, parseLanesConfig } from '../core/lanes.js';
import { parseOutbox } from '../core/laneStatus.js';
import {
  SCHEDULE_FILE, applyBackoff, dueEntry, formatSchedule, notDueReason, parseSchedule, parseUntil, trailingIdleRuns, wakeEntry, wakeReasons,
  type NotDueReason, type WakeReason,
} from '../core/parse/schedule.js';
import { parseRunLog, runLogPath, type RunEntry } from '../core/parse/runs.js';
import { addSteerEntry, parseSteer, steerPath } from '../core/parse/steer.js';
import type { Schedule, ScheduleEntry, SteerScope } from '../core/types.js';
import { git, pushIfWanted, syncFirst } from './pause.js';

export interface ScheduleOptions {
  /** Skip the commit (and push); the file is still written. */
  commit?: boolean;
  push?: boolean;
  now?: Date;
}

export interface LaneScheduleRow {
  lane: string;
  /** `due`, or why the lane is held back. */
  state: 'due' | NotDueReason;
  entry: ScheduleEntry;
  idleRuns: number;
}

export interface ScheduleReport {
  lanes: LaneScheduleRow[];
}

export interface ScheduleResult {
  /** The lanes whose entry changed. */
  changed: string[];
  committed: boolean;
  pushed?: boolean;
  pushError?: string;
  /** Per lane, why `update` woke it. */
  woken?: Record<string, WakeReason[]>;
}

const read = (dir: string, rel: string) => readFile(path.join(dir, ...rel.split('/')), 'utf8').catch(() => undefined);

export async function readSchedule(dir: string): Promise<Schedule> {
  return parseSchedule((await read(dir, SCHEDULE_FILE)) ?? '');
}

/** Lane names from `.ai/lanes.json`; undefined when the repo has none (any simple name is then accepted). */
async function knownLanes(dir: string): Promise<string[] | undefined> {
  const text = await read(dir, '.ai/lanes.json');
  const parsed = text === undefined ? undefined : parseLanesConfig(text).config;
  return parsed?.lanes.map((l) => l.name);
}

async function checkLane(dir: string, lane: string): Promise<void> {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(lane)) throw new Error(`"${lane}" is not a lane name.`);
  const names = await knownLanes(dir);
  if (names && !names.includes(lane)) throw new Error(`No lane "${lane}". Lanes here: ${names.join(', ')}.`);
}

async function writeRel(dir: string, rel: string, text: string): Promise<void> {
  const file = path.join(dir, ...rel.split('/'));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text);
}

/** Writes nothing when `commit` is false; otherwise commits the files with `Lane: control` and (by default) pushes. */
async function commitFiles(dir: string, files: string[], message: string, options: ScheduleOptions, result: ScheduleResult, trailer: string = CONTROL_LANE): Promise<void> {
  if (options.commit === false || result.changed.length === 0) return;
  await git(dir, 'add', '--', ...files);
  await git(dir, 'commit', '-qm', `${message}\n\nLane: ${trailer}`, '--', ...files);
  result.committed = true;
  await pushIfWanted(dir, result, options.push);
}

export async function runScheduleShow(dir: string, now = new Date()): Promise<ScheduleReport> {
  const schedule = await readSchedule(dir);
  const names = (await knownLanes(dir)) ?? Object.keys(schedule.lanes);
  const lanes: LaneScheduleRow[] = [];
  for (const lane of names) {
    const entry = schedule.lanes[lane] ?? dueEntry();
    const runs = parseRunLog((await read(dir, runLogPath(lane))) ?? '');
    lanes.push({ lane, state: notDueReason(entry, now) ?? 'due', entry, idleRuns: trailingIdleRuns(runs) });
  }
  return { lanes };
}

export function formatScheduleReport(report: ScheduleReport): string {
  if (report.lanes.length === 0) return 'No lanes. Create .ai/lanes.json with `loop init --lanes a,b,c`.';
  return report.lanes
    .map(({ lane, state, entry, idleRuns }) => {
      const detail = [entry.notBefore && state === 'snoozed' ? `until ${entry.notBefore.slice(0, 16).replace('T', ' ')} UTC` : '', idleRuns ? `${idleRuns} idle run${idleRuns === 1 ? '' : 's'}` : '', entry.reason ?? ''].filter(Boolean).join(' · ');
      return `${lane.padEnd(10)} ${state.padEnd(9)} ${detail}`.trimEnd();
    })
    .join('\n');
}

export type ScheduleAction =
  | { action: 'pause'; lane: string; reason?: string }
  | { action: 'resume'; lane: string }
  | { action: 'snooze'; lane: string; until: string; reason?: string }
  | { action: 'wake'; lane: string };

const WOKEN = 'woken at ';

/** Applies one owner action to `.ai/schedule.json`. `wake` takes a lane name or `all`. */
export async function runScheduleAction(dir: string, act: ScheduleAction, options: ScheduleOptions = {}): Promise<ScheduleResult> {
  const now = options.now ?? new Date();
  if (options.commit !== false) await syncFirst(dir, options.push);
  const lanes = act.action === 'wake' && act.lane === 'all' ? ((await knownLanes(dir)) ?? Object.keys((await readSchedule(dir)).lanes)) : [act.lane];
  if (!(act.action === 'wake' && act.lane === 'all')) await checkLane(dir, act.lane);
  const schedule = await readSchedule(dir);
  const result: ScheduleResult = { changed: [], committed: false };
  for (const lane of lanes) {
    const before = schedule.lanes[lane] ?? dueEntry();
    let after: ScheduleEntry;
    if (act.action === 'pause') after = { ...before, paused: true, reason: act.reason?.replace(/\s+/g, ' ').trim() || 'paused by owner' };
    else if (act.action === 'resume') after = { ...before, paused: false, reason: null };
    else if (act.action === 'snooze') {
      const until = parseUntil(act.until, now);
      if (!until) throw new Error(`Cannot read "${act.until}" as a future time. Use an ISO time, a date, or a span such as 3h or 2d.`);
      after = { ...before, notBefore: until.toISOString(), sleeping: false, reason: act.reason?.replace(/\s+/g, ' ').trim() || 'snoozed by owner' };
    } else after = { ...wakeEntry(before), reason: `${WOKEN}${now.toISOString()}` };
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      schedule.lanes[lane] = after;
      result.changed.push(lane);
    }
  }
  if (result.changed.length === 0) return result;
  await writeRel(dir, SCHEDULE_FILE, formatSchedule(schedule));
  await commitFiles(dir, [SCHEDULE_FILE], `Schedule: ${act.action} ${result.changed.join(', ')}`, options, result);
  return result;
}

export interface UpdateOptions extends ScheduleOptions {
  /** A new round started: wakes every lane. */
  newRound?: boolean;
  /** Only this lane's entry is changed and the commit carries `Lane: <lane>` (a lane applying its own backoff, lane-run.md step 8). */
  lane?: string;
}

/**
 * `loop schedule update`: wake lanes that have something waiting (unacknowledged steer, a message newer than their
 * last run, a new round), otherwise apply the idle backoff from each lane's runs.jsonl. A lane woken by hand stays
 * woken until it logs a run.
 */
export async function runScheduleUpdate(dir: string, options: UpdateOptions = {}): Promise<ScheduleResult> {
  const now = options.now ?? new Date();
  if (options.commit !== false) await syncFirst(dir, options.push);
  const schedule = await readSchedule(dir);
  if (options.lane) await checkLane(dir, options.lane);
  const names = options.lane ? [options.lane] : ((await knownLanes(dir)) ?? Object.keys(schedule.lanes));
  const controlRoom = parseOutbox('control', (await read(dir, '.ai/control-room.md')) ?? '');
  const outboxes = (await Promise.all((await knownLanes(dir) ?? names).map(async (lane) => parseOutbox(lane, (await read(dir, `.ai/lanes/${lane}/outbox.md`)) ?? '')))).flat();
  const result: ScheduleResult = { changed: [], committed: false, woken: {} };
  for (const lane of names) {
    const before = schedule.lanes[lane] ?? dueEntry();
    if (before.paused) continue;
    const runs: RunEntry[] = parseRunLog((await read(dir, runLogPath(lane))) ?? '');
    const lastRunAt = runs.at(-1)?.at;
    const manualWake = before.reason?.startsWith(WOKEN) && (!lastRunAt || new Date(lastRunAt).getTime() < new Date(before.reason.slice(WOKEN.length)).getTime());
    const reasons = wakeReasons({
      lane,
      ...(lastRunAt && { lastRunAt }),
      steer: parseSteer((await read(dir, steerPath(lane))) ?? ''),
      messages: [...controlRoom, ...outboxes.filter((m) => m.from !== lane)],
      ...(options.newRound && { newRound: true }),
    });
    let after = before;
    if (manualWake) continue;
    if (reasons.length > 0) {
      if (notDueReason(before, now)) {
        after = { ...wakeEntry(before), reason: `woken: ${reasons.join(', ')}` };
        result.woken![lane] = reasons;
      }
    } else after = applyBackoff(runs, before, now);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      schedule.lanes[lane] = after;
      result.changed.push(lane);
    }
  }
  if (result.changed.length === 0) return result;
  await writeRel(dir, SCHEDULE_FILE, formatSchedule(schedule));
  await commitFiles(dir, [SCHEDULE_FILE], `Schedule: update ${result.changed.join(', ')}`, options, result, options.lane ?? CONTROL_LANE);
  return result;
}

export interface SteerOptions extends ScheduleOptions {
  standing?: boolean;
  /** Defaults to `git config user.name`. */
  author?: string;
}

/** `loop steer`: adds a steer entry for a lane, wakes the lane in the schedule and commits both files. */
export async function runSteer(dir: string, lane: string, text: string, options: SteerOptions = {}): Promise<ScheduleResult> {
  const now = options.now ?? new Date();
  if (!text.trim()) throw new Error('Say what the lane should do: loop steer <lane> "<text>".');
  await checkLane(dir, lane);
  if (options.commit !== false) await syncFirst(dir, options.push);
  const author = (options.author ?? (await git(dir, 'config', 'user.name').then((r) => r.stdout.trim(), () => ''))).trim();
  if (!author) throw new Error('Say who you are with --author <name> (git user.name is not set).');
  const scope: SteerScope = options.standing ? 'standing' : 'next-run';
  const file = steerPath(lane);
  const current = (await read(dir, file)) ?? `# Steering for the ${lane} lane\n`;
  await writeRel(dir, file, addSteerEntry(current, { at: now, author, scope, text }));
  const schedule = await readSchedule(dir);
  const before = schedule.lanes[lane];
  const result: ScheduleResult = { changed: [lane], committed: false };
  const files = [file];
  if (before && (before.sleeping || before.notBefore)) {
    schedule.lanes[lane] = { ...wakeEntry(before), reason: 'woken: steer' };
    await writeRel(dir, SCHEDULE_FILE, formatSchedule(schedule));
    files.push(SCHEDULE_FILE);
  }
  await commitFiles(dir, files, `Steer ${lane} (${scope}): ${text.trim().split(/\r?\n/)[0]?.slice(0, 60)}`, options, result);
  return result;
}
