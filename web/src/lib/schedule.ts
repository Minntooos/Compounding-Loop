import { notDueReason } from '../../../src/core/parse/schedule.js';
import type { LaneState, LoopSummary, ScheduleEntry, SteerAck } from '../../../src/core/types.js';
import { dueTime } from './strip.js';

export type LaneScheduleKind = 'due' | 'stopped' | 'loop-paused' | 'paused' | 'sleeping' | 'snoozed';

const runs = (n: number): string => `${n} idle run${n === 1 ? '' : 's'}`;

/**
 * A lane's schedule as one sentence (DESIGN §12 C5: the state reads before any button), e.g.
 * "Sleeping · 3 idle runs · docs waits for the first features". The reason is repo text: render as a text node.
 */
export function laneScheduleState(input: { entry?: ScheduleEntry; idleRuns?: number; loopPaused?: boolean; laneState?: LaneState; now: Date }): { kind: LaneScheduleKind; text: string } {
  const { entry, idleRuns = 0, loopPaused, laneState, now } = input;
  if (loopPaused) return { kind: 'loop-paused', text: 'Paused with the whole loop' };
  // A finished or blocked lane stops itself (its DONE.md / BLOCKED.md), whatever the schedule says.
  if (laneState === 'done') return { kind: 'stopped', text: 'Finished · no more runs' };
  if (laneState === 'blocked') return { kind: 'stopped', text: 'Stopped until its question is answered' };
  const reason = notDueReason(entry, now);
  const why = entry?.reason?.trim() ? ` · ${entry.reason.trim()}` : '';
  // The backoff's own reason is "3 idle runs in a row": then the count is already said.
  const count = idleRuns > 0 && !/idle run/i.test(why) ? ` · ${runs(idleRuns)}` : '';
  switch (reason) {
    case 'paused': return { kind: 'paused', text: `Paused${why}` };
    case 'sleeping': return { kind: 'sleeping', text: `Sleeping${count}${why}` };
    // notDueReason only says 'snoozed' when notBefore is set and in the future.
    case 'snoozed': return { kind: 'snoozed', text: `Snoozed until ${dueTime(entry?.notBefore ?? '', now)}${why}` };
    default: return { kind: 'due', text: idleRuns > 0 ? `Due · ${runs(idleRuns)} in a row` : 'Due' };
  }
}

/** The acknowledgement chip under a steer entry (DESIGN §12 C4 Steer history). */
export function steerAckChip(ack: SteerAck | undefined, laneState?: LaneState): { tone: 'done' | 'blocked' | 'muted'; text: string } {
  // A finished lane never runs again, so an unread entry is not "waiting": it will not be picked up.
  if (!ack && laneState === 'done') return { tone: 'blocked', text: 'not picked up: the lane is finished' };
  if (!ack && laneState === 'blocked') return { tone: 'muted', text: 'waiting until the lane’s question is answered' };
  if (!ack) return { tone: 'muted', text: 'waiting for the next run' };
  return ack.state === 'done' ? { tone: 'done', text: `done in run ${ack.run}` } : { tone: 'blocked', text: `not done: ${ack.why}` };
}

/**
 * The clock a loop's schedule is read at. Snapshot data is frozen, so it is read at its own newest moment (the last run or
 * the snapshot), never today: otherwise a frozen snooze would expire while the frozen run outcomes still call it sleeping.
 */
export function scheduleClock(loop: Pick<LoopSummary, 'lastRun'> & { snapshotAt?: string }, now: Date): Date {
  if (!loop.snapshotAt) return now;
  const times = [loop.snapshotAt, loop.lastRun?.at].map((t) => (t ? new Date(t).getTime() : NaN)).filter((t) => !Number.isNaN(t));
  return times.length ? new Date(Math.max(...times)) : now;
}
