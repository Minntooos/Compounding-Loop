// What happened at each scheduled run slot, for the heat map, the Runs tab and `loop runs`. Pure.
import type { Schedule } from '../types.js';
import { expectedSlots, matchSlots, type RunEntry, type SlotResult } from './runs.js';
import { dueEntry, notDueReason } from './schedule.js';

export type RunOutcome =
  /** A run with units, or one that pushed. */
  | 'worked'
  /** The run started and found nothing to do. */
  | 'idle'
  /** The schedule said skip ("Not due"), so no run was expected. */
  | 'not-due'
  /** Inside the 50-minute window with no line yet. */
  | 'running'
  /** Due, the window passed, no line: a usage-limit stop or a failed start. */
  | 'missed'
  | 'tests-failed'
  | 'paused'
  /** Root DONE, or the lane is done or blocked: nothing is expected. */
  | 'done';

export interface ClassifiedSlot extends SlotResult {
  kind: RunOutcome;
}

export interface LaneInput {
  name: string;
  cron?: string;
}

export interface ClassifyInput {
  lanes: readonly LaneInput[];
  /** Each lane's run log. */
  runs: ReadonlyMap<string, readonly RunEntry[]>;
  schedule: Schedule;
  /** `.ai/PAUSED` exists. */
  paused: boolean;
  /** Root DONE.md or BLOCKED.md exists. */
  rootDone: boolean;
  /** Lanes with their own DONE.md or BLOCKED.md. */
  laneDone: ReadonlySet<string>;
  now: Date;
  /** Start of the window; default 24 h before `now`. */
  from?: Date;
  /** Commit times per lane, for runs that forgot the log step. */
  commits?: ReadonlyMap<string, readonly Date[]>;
}

export interface ClassifiedRuns {
  lanes: { lane: string; slots: ClassifiedSlot[] }[];
  /** No lane has logged a run for 6 h although runs were expected: show "Routines look off" once instead of a wall of misses. */
  routinesLookOff: boolean;
}

export const RUN_WINDOW_MS = 50 * 60_000;
export const SILENCE_MS = 6 * 3_600_000;

function kindOf(slot: SlotResult, input: ClassifyInput, lane: string, entries: readonly RunEntry[]): RunOutcome {
  if (slot.entry) return slot.outcome === 'tests-failed' ? 'tests-failed' : slot.outcome === 'pushed' || slot.entry.units.length > 0 ? 'worked' : 'idle';
  if (slot.outcome === 'pushed') return 'worked';
  if (input.rootDone || input.laneDone.has(lane)) return 'done';
  if (input.paused) return 'paused';
  const at = new Date(slot.slot);
  const lastRun = entries.reduce((max, e) => Math.max(max, new Date(e.at).getTime()), 0);
  // A later run proves the lane was due at this slot, whatever the schedule says today.
  if (at.getTime() > lastRun) {
    const entry = input.schedule.lanes[lane] ?? dueEntry();
    const reason = notDueReason(entry, at);
    if (reason) return 'not-due';
  }
  return input.now.getTime() - at.getTime() < RUN_WINDOW_MS ? 'running' : 'missed';
}

/** Classifies every cron slot of every lane in the window. A lane without a cron has no expected slots. */
export function classifyRunSlots(input: ClassifyInput): ClassifiedRuns {
  const from = input.from ?? new Date(input.now.getTime() - 24 * 3_600_000);
  const lanes = input.lanes.map(({ name, cron }) => {
    const entries = input.runs.get(name) ?? [];
    const matched = cron ? matchSlots(expectedSlots(cron, from, input.now), entries, input.commits?.get(name) ?? []) : [];
    return { lane: name, slots: matched.map((s): ClassifiedSlot => ({ ...s, kind: kindOf(s, input, name, entries) })) };
  });
  const newest = [...input.runs.values()].flat().reduce((max, e) => Math.max(max, new Date(e.at).getTime()), 0);
  const silent = input.now.getTime() - newest >= SILENCE_MS;
  const missed = lanes.some((l) => l.slots.some((s) => s.kind === 'missed'));
  const routinesLookOff = !input.paused && !input.rootDone && silent && missed;
  return { lanes, routinesLookOff };
}

/** Scheduled runs in a row, newest first, that were due and left no trace. Slots nobody expected a run for are skipped. */
export function missedRun(slots: readonly ClassifiedSlot[]): number {
  let count = 0;
  for (let i = slots.length - 1; i >= 0; i--) {
    const kind = slots[i]?.kind;
    if (kind === 'missed') count++;
    else if (kind !== 'not-due' && kind !== 'running') break;
  }
  return count;
}
