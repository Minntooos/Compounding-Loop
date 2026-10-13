// Pure (no Node imports): turns the per-lane run logs, the cron slots and the commits into the Runs tab's data.
import { classifyRunSlots, expectedSlots, matchSlots, missedInARow, parseRunLog } from '../core/parse/index.js';
import type { RunEntry, SlotResult } from '../core/parse/index.js';
import type { InboxItem, LoopCommit, LoopRun, Schedule } from '../core/types.js';

export interface RunLane {
  name: string;
  /** 5-field cron from `.ai/lanes.json`; a lane without one only shows the runs it logged. */
  cron?: string;
  /** Done, blocked or claimed on purpose: its missing slots are not a problem. */
  stopped?: boolean;
}

export interface RunsInput {
  lanes: readonly RunLane[];
  /** Raw `.ai/lanes/<lane>/runs.jsonl` text by lane name; absent when the file does not exist. */
  logs: Readonly<Record<string, string | undefined>>;
  /** Newest first, each with the lane it belongs to. */
  commits: readonly LoopCommit[];
  now: Date;
  /** `.ai/PAUSED` exists: runs reply "Paused" and log nothing, so slots from `at` on (all, if unknown) are not missing. */
  paused?: { at?: Date };
  /** `.ai/schedule.json`: a slot the schedule skipped (paused, sleeping, snoozed) is "Not due", not a missing run. */
  schedule?: Schedule;
}

export interface RunsData {
  /** Newest first. */
  runs: LoopRun[];
  nextRuns: { lane: string; at: string }[];
  /** Lanes with 3 or more scheduled runs in a row that left no trace. */
  silentLanes: { lane: string; missed: number }[];
  /** Nothing logged for 6 h although runs were due: the routines themselves look off. */
  routinesLookOff: boolean;
}

/** How far back the Runs tab looks. */
export const RUNS_WINDOW_HOURS = 48;
/** A slot this young may still be running (the log line is written at the end), so it is not "missing" yet. */
export const SLOT_GRACE_MINUTES = 90;
/** Missing runs in a row that raise the "lanes are not running" attention item. */
export const SILENT_STREAK = 3;

const HOUR = 3_600_000;
const MINUTE = 60_000;

/** Slots (ISO, by lane) that no run was expected for, according to `schedule.json`. */
function notDueSlots(input: RunsInput, from: Date): { skipped: Map<string, Set<string>>; routinesLookOff: boolean } {
  const runs = new Map(input.lanes.map((l) => [l.name, parseRunLog(input.logs[l.name] ?? '')] as const));
  const commits = new Map<string, Date[]>();
  for (const c of input.commits) if (c.lane) commits.set(c.lane, [...(commits.get(c.lane) ?? []), new Date(c.at)]);
  const classified = classifyRunSlots({
    lanes: input.lanes, runs, schedule: input.schedule ?? { version: 1, lanes: {} }, paused: false, rootDone: false, laneDone: new Set(), now: input.now, from, commits,
  });
  const skipped = new Map(classified.lanes.map((l) => [l.lane, new Set(l.slots.filter((s) => s.kind === 'not-due').map((s) => s.slot))] as const));
  return { skipped, routinesLookOff: !input.paused && classified.routinesLookOff };
}

function laneRuns(lane: RunLane, input: RunsInput, skipped: ReadonlySet<string>): { runs: LoopRun[]; next?: string; missed: number } {
  const from = new Date(input.now.getTime() - RUNS_WINDOW_HOURS * HOUR);
  const everLogged = parseRunLog(input.logs[lane.name] ?? '');
  const entries = everLogged.filter((e) => new Date(e.at) > from);
  const own = input.commits.filter((c) => c.lane === lane.name);
  const slots = lane.cron ? expectedSlots(lane.cron, from, input.now) : [];
  const next = lane.cron ? expectedSlots(lane.cron, input.now, new Date(input.now.getTime() + 7 * 24 * HOUR))[0]?.toISOString() : undefined;
  const results: SlotResult[] = slots.length > 0 ? matchSlots(slots, entries, own.map((c) => new Date(c.at))) : [];
  // Entries that answered no slot (a manual run, or a lane without cron) are runs too.
  const claimed = new Set(results.flatMap((r) => (r.entry ? [r.entry.at] : [])));
  const manual: SlotResult[] = entries.filter((e) => !claimed.has(e.at)).map((entry) => ({ slot: new Date(entry.at).toISOString(), entry, outcome: outcomeOf(entry) }));
  const graceEnd = input.now.getTime() - SLOT_GRACE_MINUTES * MINUTE;
  const pausedFrom = input.paused ? (input.paused.at?.getTime() ?? -Infinity) : Infinity;
  const settled = results.filter((r) => r.outcome !== 'no-run-recorded' || (!skipped.has(r.slot) && new Date(r.slot).getTime() <= graceEnd && new Date(r.slot).getTime() < pausedFrom));
  const all = [...settled, ...manual].sort((a, b) => a.slot.localeCompare(b.slot));
  const loggedSessions = new Set(entries.flatMap((e) => (e.session ? [sessionKey(e.session)] : [])));
  const runs = all.map((r, i): LoopRun => {
    const windowStart = new Date(r.slot).getTime();
    const windowEnd = all[i + 1] ? new Date((all[i + 1] as SlotResult).slot).getTime() : Infinity;
    const session = r.entry?.session === undefined ? undefined : sessionKey(r.entry.session);
    const inWindow = (c: LoopCommit) => at(c) >= windowStart && at(c) < windowEnd;
    // A commit of this run's session belongs to it; a commit of another logged session belongs to that run; the rest go by time.
    const belongs = (c: LoopCommit) => (c.session !== undefined && c.session === session) || (inWindow(c) && !(c.session !== undefined && loggedSessions.has(c.session)));
    const commits = own.filter(belongs);
    return {
      lane: lane.name,
      at: new Date(r.slot).toISOString(),
      outcome: r.outcome,
      ...(r.entry && { endedAt: new Date(r.entry.at).toISOString() }),
      units: r.entry?.units ?? [],
      ...(r.entry?.tests && { tests: r.entry.tests }),
      commits,
      ...(r.entry?.note && { note: r.entry.note }),
    };
  });
  return { runs, ...(next && { next }), // A lane that never logged a run or made a commit is new, not silent.
  missed: !lane.stopped && !input.paused && (everLogged.length > 0 || own.length > 0) ? missedInARow(settled) : 0 };
}

const at = (c: LoopCommit) => new Date(c.at).getTime();
const outcomeOf = (e: RunEntry): LoopRun['outcome'] => (e.tests && e.tests.failed > 0 ? 'tests-failed' : e.pushed ? 'pushed' : 'nothing-pushed');

/** The last 8 characters of a session id or `Claude-Session:` URL, the key commits and run lines share. */
export function sessionKey(idOrUrl: string): string {
  return idOrUrl.trim().replace(/\/+$/, '').slice(-8);
}

export function buildRuns(input: RunsInput): RunsData {
  const { skipped, routinesLookOff } = notDueSlots(input, new Date(input.now.getTime() - RUNS_WINDOW_HOURS * HOUR));
  const perLane = input.lanes.map((lane) => ({ lane, ...laneRuns(lane, input, skipped.get(lane.name) ?? new Set()) }));
  return {
    runs: perLane.flatMap((l) => l.runs).sort((a, b) => b.at.localeCompare(a.at)),
    nextRuns: perLane.flatMap((l) => (l.next ? [{ lane: l.lane.name, at: l.next }] : [])),
    silentLanes: perLane.filter((l) => l.missed >= SILENT_STREAK).map((l) => ({ lane: l.lane.name, missed: l.missed })),
    routinesLookOff,
  };
}

/** The attention item for lanes that stopped running, or none. */
export function silentLanesItem(loopId: string, silent: RunsData['silentLanes'], since: string): InboxItem | undefined {
  if (silent.length === 0) return undefined;
  return {
    loopId,
    file: '.ai/lanes.json',
    kind: 'lanes-not-running',
    question: `Lanes are not running: ${silent.map((s) => `${s.lane} (${s.missed} missed)`).join(', ')}. Check your plan's usage limit.`,
    bestGuess: 'Wait for the limit to reset, or run a lane by hand',
    since,
  };
}

/** The newest run of any lane, for the fleet card. Missing runs count: they are what the owner needs to see. */
export function lastRunOf(runs: readonly LoopRun[]): { lane: string; at: string; outcome: LoopRun['outcome'] } | undefined {
  const newest = runs[0];
  return newest && { lane: newest.lane, at: newest.at, outcome: newest.outcome };
}
