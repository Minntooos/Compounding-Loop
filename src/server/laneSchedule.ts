// Pure (no Node imports): a lane that is not due is not stalled. The live dashboard runs this in the browser.
import { notDueReason } from '../core/parse/index.js';
import type { LaneStatus, Schedule } from '../core/types.js';

/**
 * Lanes the schedule or a root PAUSED file keeps from running are waiting on purpose: core's `deriveLaneState`
 * only sees commit times, so it calls them stalled. Done and blocked lanes keep their state.
 */
export function settleNotDue(lanes: readonly LaneStatus[], schedule: Schedule | undefined, paused: boolean, now: Date): LaneStatus[] {
  return lanes.map((lane) => {
    if (lane.state !== 'stalled') return lane;
    const off = paused || notDueReason(schedule?.lanes[lane.name], now) !== undefined;
    return off ? { ...lane, state: 'waiting' } : lane;
  });
}
