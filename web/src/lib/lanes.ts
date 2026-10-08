import type { LaneState, LaneStatus, LoopSummary } from '../../../src/core/types.js';

export const LANE_LABEL: Record<LaneState, string> = {
  building: 'Building', waiting: 'Waiting', blocked: 'Blocked', done: 'Done', stalled: 'Stalled',
};

/** Lanes that are not finished but wait on a lane that is: nobody will ever answer them. */
export function waitingOnFinished(lanes: LaneStatus[]): LaneStatus[] {
  const done = new Set(lanes.filter((l) => l.state === 'done').map((l) => l.name));
  return lanes.filter((l) => l.state !== 'done' && (l.waitingOn ?? []).some((w) => done.has(w)));
}

/** Lanes that need the owner: stalled, blocked, or waiting on a finished lane. */
export function lanesNeedingYou(lanes: LaneStatus[] | undefined): LaneStatus[] {
  if (!lanes) return [];
  const stalled = lanes.filter((l) => l.state === 'stalled' || l.state === 'blocked');
  const orphaned = waitingOnFinished(lanes).filter((l) => l.state !== 'stalled' && l.state !== 'blocked');
  return [...stalled, ...orphaned];
}

/**
 * The "Needs you" total: inbox items, plus per loop its lane problems, or 1 for a failing loop that has none.
 * The inbox only lists a root BLOCKED.md, so a blocked lane is counted here, unless that loop already has an inbox item.
 */
export function needsYouCount(loops: LoopSummary[], inbox: { loopId: string }[]): number {
  return loops.reduce((sum, l) => {
    const inInbox = inbox.some((i) => i.loopId === l.id);
    const lanes = lanesNeedingYou(l.lanes).filter((x) => !(inInbox && x.state === 'blocked')).length;
    return sum + (lanes > 0 ? lanes : l.state === 'failing' ? 1 : 0);
  }, inbox.length);
}

/** "web → server: …" for one unanswered message. */
export function describeUnanswered(u: { from: string; to: string; text: string }): string {
  return `${u.from} → ${u.to}: ${u.text}`;
}
