import { notDueReason } from '../../../src/core/parse/schedule.js';
import type { LaneState, LoopSummary, ScheduleEntry, SteerAck } from '../../../src/core/types.js';
import { scheduleEditUrl } from '../../../src/server/controls.js';
import { dueTime } from './strip.js';

export { scheduleEditUrl };

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

/** The schedule hold a lane badge shows instead of Building/Waiting. */
export type LaneHold = 'loop-paused' | 'paused' | 'sleeping' | 'snoozed';

/**
 * A building or waiting lane that the schedule holds back runs nothing, so its badge says the hold, not "Building" next to
 * "Paused" (design review, run 5). Stalled, blocked and done keep their badge: the schedule is not their story.
 */
export function laneHold(laneState: LaneState, kind: LaneScheduleKind | undefined): LaneHold | undefined {
  if (laneState !== 'building' && laneState !== 'waiting') return undefined;
  return kind === 'loop-paused' || kind === 'paused' || kind === 'sleeping' || kind === 'snoozed' ? kind : undefined;
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

export type ScheduleButton = 'pause' | 'resume' | 'snooze' | 'wake';

/**
 * The schedule buttons that make sense for a lane's state (DESIGN §12 C5): a due lane can be paused or snoozed, a paused one
 * resumed, a held-back one woken or paused. A finished, blocked or loop-paused lane gets none: the schedule is not what stops it.
 */
export function scheduleButtons(kind: LaneScheduleKind): ScheduleButton[] {
  switch (kind) {
    case 'due': return ['pause', 'snooze'];
    case 'paused': return ['resume'];
    case 'sleeping': case 'snoozed': return ['wake', 'pause'];
    default: return [];
  }
}

/** Snooze presets: spans core's `parseUntil` reads, and tomorrow 09:00 UTC as an ISO time. */
export function snoozePresets(now: Date): { label: string; until: string }[] {
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 9));
  return [{ label: '1 h', until: '1h' }, { label: '3 h', until: '3h' }, { label: 'Tomorrow 09:00', until: tomorrow.toISOString() }];
}

/** The toast after a schedule action: what was written, in words. `changed: false` means it already was that way. */
export function scheduleToast(action: ScheduleButton, lane: string, changed: boolean, presetLabel?: string): string {
  if (!changed) return `Nothing to change: ${lane} already was that way`;
  switch (action) {
    case 'pause': return `Paused ${lane}: it skips its runs until you resume it`;
    case 'resume': return `Resumed ${lane}: it runs at its next slot`;
    case 'wake': return `Woke ${lane}: it runs at its next slot`;
    case 'snooze': return `Snoozed ${lane}${presetLabel ? ` for ${presetLabel}` : ''}: it skips its runs until then`;
  }
}
