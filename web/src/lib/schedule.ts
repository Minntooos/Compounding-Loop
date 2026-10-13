import { notDueReason } from '../../../src/core/parse/schedule.js';
import type { ScheduleEntry, SteerAck } from '../../../src/core/types.js';
import { dueTime } from './strip.js';

export type LaneScheduleKind = 'due' | 'loop-paused' | 'paused' | 'sleeping' | 'snoozed';

const runs = (n: number): string => `${n} idle run${n === 1 ? '' : 's'}`;

/**
 * A lane's schedule as one sentence (DESIGN §12 C5: the state reads before any button), e.g.
 * "Sleeping · 3 idle runs · docs waits for the first features". The reason is repo text: render as a text node.
 */
export function laneScheduleState(input: { entry?: ScheduleEntry; idleRuns?: number; loopPaused?: boolean; now: Date }): { kind: LaneScheduleKind; text: string } {
  const { entry, idleRuns = 0, loopPaused, now } = input;
  if (loopPaused) return { kind: 'loop-paused', text: 'Paused with the whole loop' };
  const reason = notDueReason(entry, now);
  const why = entry?.reason?.trim() ? ` · ${entry.reason.trim()}` : '';
  switch (reason) {
    case 'paused': return { kind: 'paused', text: `Paused${why}` };
    case 'sleeping': return { kind: 'sleeping', text: `Sleeping${idleRuns > 0 ? ` · ${runs(idleRuns)}` : ''}${why}` };
    // notDueReason only says 'snoozed' when notBefore is set and in the future.
    case 'snoozed': return { kind: 'snoozed', text: `Snoozed until ${dueTime(entry?.notBefore ?? '', now)}${why}` };
    default: return { kind: 'due', text: idleRuns > 0 ? `Due · ${runs(idleRuns)} in a row` : 'Due' };
  }
}

/** The acknowledgement chip under a steer entry (DESIGN §12 C4 Steer history). */
export function steerAckChip(ack: SteerAck | undefined): { tone: 'done' | 'blocked' | 'muted'; text: string } {
  if (!ack) return { tone: 'muted', text: 'waiting for the next run' };
  return ack.state === 'done' ? { tone: 'done', text: `done in run ${ack.run}` } : { tone: 'blocked', text: `not done: ${ack.why}` };
}
