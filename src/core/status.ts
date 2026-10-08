import type { LoopFacts, LoopStatus } from './types.js';

export const LOCK_MINUTES = 90;
export const RECENT_COMMIT_MINUTES = 60;

const minutesBetween = (later: Date, earlier: Date) => (later.getTime() - earlier.getTime()) / 60_000;

/** Applies the status rules from IDEA.md in order; a failing health check overrides everything. */
export function deriveStatus(facts: LoopFacts, now: Date = new Date()): LoopStatus {
  const [firstFailure] = facts.healthFailures;
  if (firstFailure !== undefined) return { state: 'failing', reason: firstFailure };
  if (facts.hasBlocked) return { state: 'blocked', reason: 'BLOCKED.md is waiting for an answer' };
  if (facts.hasDone) return { state: 'done', reason: `Round ${facts.roundsDone + 1} finished` };
  if (facts.lockAt && minutesBetween(now, facts.lockAt) < LOCK_MINUTES) {
    return { state: 'building', reason: 'A session holds the lock' };
  }
  if (facts.lastCommitAt && minutesBetween(now, facts.lastCommitAt) < RECENT_COMMIT_MINUTES) {
    return { state: 'building', reason: 'Committed in the last hour' };
  }
  return { state: 'waiting', reason: 'Waiting for the next scheduled run' };
}
