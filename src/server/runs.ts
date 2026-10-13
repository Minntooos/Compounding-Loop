// Pure (no Node imports): turns the per-lane run logs, the cron slots and the commits into the Runs tab's data.
import { classifyRunSlots, expectedSlots, matchSlots, missedInARow, notDueReason, parseRunLog, parseSteer, trailingIdleRuns } from '../core/parse/index.js';
import type { RunEntry, RunOutcome, SlotResult } from '../core/parse/index.js';
import type { InboxItem, LoopCommit, LoopRun, RunOutcomes, Schedule, SteerEntry } from '../core/types.js';

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
  /** Raw `.ai/lanes/<lane>/steer.md` text by lane name. */
  steerTexts?: Readonly<Record<string, string | undefined>>;
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
  /** Status-strip facts (limit stops, running, sleeping, next due). */
  outcomes: RunOutcomes;
  /** Trailing idle runs per lane. */
  idleRuns: Record<string, number>;
  /** Parsed steer files, only for lanes that have one. */
  steer: { lane: string; entries: SteerEntry[] }[];
}

/** How far back the Runs tab looks. */
export const RUNS_WINDOW_HOURS = 48;
/** How far back the lane × hour grid needs the slots nobody expected a run for. */
export const GRID_WINDOW_HOURS = 24;
/** A slot this young may still be running (the log line is written at the end), so it is not "missing" yet. */
export const SLOT_GRACE_MINUTES = 90;
/** Missing runs in a row that raise the "lanes are not running" attention item. */
export const SILENT_STREAK = 3;

const HOUR = 3_600_000;
const MINUTE = 60_000;

/** Slots (ISO, by lane) that no run was expected for, according to `schedule.json`. */
function notDueSlots(input: RunsInput, from: Date): { skipped: Map<string, Set<string>>; routinesLookOff: boolean; classified: ReturnType<typeof classifyRunSlots> } {
  const runs = new Map(input.lanes.map((l) => [l.name, parseRunLog(input.logs[l.name] ?? '')] as const));
  const commits = new Map<string, Date[]>();
  for (const c of input.commits) if (c.lane) commits.set(c.lane, [...(commits.get(c.lane) ?? []), new Date(c.at)]);
  const classified = classifyRunSlots({
    lanes: input.lanes, runs, schedule: input.schedule ?? { version: 1, lanes: {} }, paused: false, rootDone: input.lanes.length > 0 && input.lanes.every((l) => l.stopped), laneDone: new Set(input.lanes.filter((l) => l.stopped).map((l) => l.name)), now: input.now, from, commits,
  });
  const skipped = new Map(classified.lanes.map((l) => [l.lane, new Set(l.slots.filter((s) => s.kind === 'not-due').map((s) => s.slot))] as const));
  return { skipped, routinesLookOff: !input.paused && classified.routinesLookOff, classified };
}

function laneRuns(lane: RunLane, input: RunsInput, skipped: ReadonlySet<string>, kinds: ReadonlyMap<string, RunOutcome>): { runs: LoopRun[]; next?: string; missed: number } {
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
  // The heat map wants the slots nobody expected a run for (not due, paused, done) of the last day too; they never count as missed.
  // `.ai/PAUSED` is not in the classifier's input here (it would reclassify skipped slots); slots from the pause on read as paused.
  const kindOfSlot = (r: SlotResult): RunOutcome | undefined => (!r.entry && r.outcome === 'no-run-recorded' && new Date(r.slot).getTime() >= pausedFrom && !['done'].includes(kinds.get(r.slot) ?? '') ? 'paused' : kinds.get(r.slot));
  const gridFrom = input.now.getTime() - GRID_WINDOW_HOURS * HOUR;
  const quiet = results.filter((r) => !settled.includes(r) && QUIET_KINDS.has(kindOfSlot(r) as RunOutcome) && new Date(r.slot).getTime() >= gridFrom);
  const all = [...settled, ...quiet, ...manual].sort((a, b) => a.slot.localeCompare(b.slot));
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
      ...(kindFor(r, kindOfSlot(r)) && { kind: kindFor(r, kindOfSlot(r)) }),
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

export const QUIET_KINDS: ReadonlySet<RunOutcome> = new Set<RunOutcome>(['not-due', 'paused', 'done']);

/** Core's slot kind for a run: classified slots keep theirs, manual runs derive it from their log line. */
function kindFor(r: SlotResult, kind: RunOutcome | undefined): RunOutcome | undefined {
  if (kind) return kind;
  if (!r.entry) return undefined;
  return r.outcome === 'tests-failed' ? 'tests-failed' : r.outcome === 'pushed' || r.entry.units.length > 0 ? 'worked' : 'idle';
}

const at = (c: LoopCommit) => new Date(c.at).getTime();
const outcomeOf = (e: RunEntry): LoopRun['outcome'] => (e.tests && e.tests.failed > 0 ? 'tests-failed' : e.pushed ? 'pushed' : 'nothing-pushed');

/** The last 8 characters of a session id or `Claude-Session:` URL, the key commits and run lines share. */
export function sessionKey(idOrUrl: string): string {
  return idOrUrl.trim().replace(/\/+$/, '').slice(-8);
}

const LIMIT_WINDOW_HOURS = 5;

/** The status strip's facts from the classified slots and the schedule. Pure. */
function outcomesOf(input: RunsInput, classified: ReturnType<typeof classifyRunSlots>, routinesLookOff: boolean): RunOutcomes {
  const since = input.now.getTime() - LIMIT_WINDOW_HOURS * HOUR;
  const live = input.lanes.filter((l) => !l.stopped);
  const slots = classified.lanes.filter((l) => live.some((x) => x.name === l.lane)).flatMap((l) => l.slots.map((s) => ({ lane: l.lane, ...s })));
  const sleeping = live.filter((l) => ['sleeping', 'snoozed'].includes(notDueReason(input.schedule?.lanes[l.name], input.now) ?? '')).map((l) => l.name);
  const upcoming = live.flatMap((l) => {
    const entry = input.schedule?.lanes[l.name];
    if (!l.cron || input.paused || entry?.paused || entry?.sleeping) return [];
    const from = new Date(Math.max(input.now.getTime(), entry?.notBefore ? Date.parse(entry.notBefore) : 0));
    const slot = expectedSlots(l.cron, from, new Date(from.getTime() + 7 * 24 * HOUR))[0];
    return slot ? [{ lane: l.name, at: slot.toISOString() }] : [];
  }).sort((a, b) => a.at.localeCompare(b.at));
  return {
    limitStops5h: input.paused || routinesLookOff ? 0 : slots.filter((s) => s.kind === 'missed' && new Date(s.slot).getTime() >= since).length,
    running: input.paused ? [] : [...new Set(slots.filter((s) => s.kind === 'running').map((s) => s.lane))],
    sleeping,
    paused: live.filter((l) => input.schedule?.lanes[l.name]?.paused === true).map((l) => l.name),
    routinesLookOff,
    ...(upcoming[0] && { nextDue: upcoming[0] }),
  };
}

export function buildRuns(input: RunsInput): RunsData {
  const { skipped, routinesLookOff, classified } = notDueSlots(input, new Date(input.now.getTime() - RUNS_WINDOW_HOURS * HOUR));
  const perLane = input.lanes.map((lane) => ({ lane, ...laneRuns(lane, input, skipped.get(lane.name) ?? new Set(), new Map(classified.lanes.find((c) => c.lane === lane.name)?.slots.map((x) => [x.slot, x.kind]) ?? [])) }));
  return {
    runs: perLane.flatMap((l) => l.runs).sort((a, b) => b.at.localeCompare(a.at)),
    nextRuns: perLane.flatMap((l) => (l.next ? [{ lane: l.lane.name, at: l.next }] : [])),
    silentLanes: perLane.filter((l) => l.missed >= SILENT_STREAK).map((l) => ({ lane: l.lane.name, missed: l.missed })),
    routinesLookOff,
    outcomes: outcomesOf(input, classified, routinesLookOff),
    idleRuns: Object.fromEntries(input.lanes.map((l) => [l.name, trailingIdleRuns(parseRunLog(input.logs[l.name] ?? ''))])),
    steer: input.lanes.flatMap((l) => {
      const text = input.steerTexts?.[l.name];
      return text === undefined ? [] : [{ lane: l.name, entries: parseSteer(text) }];
    }),
  };
}

/** The attention item for lanes that stopped running, or none. After 6 h of silence the usage-limit advice is wrong, so the "Routines look off" row replaces it. */
export function silentLanesItem(loopId: string, silent: RunsData['silentLanes'], since: string, routinesLookOff = false): InboxItem | undefined {
  if (silent.length === 0 || routinesLookOff) return undefined;
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
  // Slots nobody expected a run for (kept for the heat map) are not "the last run".
  const newest = runs.find((r) => !(r.kind && QUIET_KINDS.has(r.kind)));
  return newest && { lane: newest.lane, at: newest.at, outcome: newest.outcome };
}
