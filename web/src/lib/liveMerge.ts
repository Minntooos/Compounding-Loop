import type { HealthCheck, InboxItem, LoopDetail, LoopSummary } from '../../../src/core/types.js';

/** The live copy of a loop replaces the snapshot's copy of the same id, and goes first. */
export function mergeLoops(snapshot: LoopSummary[], live: LoopDetail | undefined): LoopSummary[] {
  return live ? [live, ...snapshot.filter((l) => l.id !== live.id)] : snapshot;
}

/** Inbox items and checks for the live loop come from GitHub; every other loop keeps its snapshot rows. */
export function mergeFacts<T extends InboxItem | HealthCheck>(snapshot: T[], liveId: string | undefined, live: T[]): T[] {
  return liveId === undefined ? snapshot : [...live, ...snapshot.filter((x) => x.loopId !== liveId)];
}
