import type { InboxItem, LaneState, LaneStatus, LoopSummary } from '../../../src/core/types.js';

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

/** A laned loop whose round is done has a root DONE.md: the release (and the next round) wait for the owner, until the version has shipped. */
export function releaseWaiting(loop: Pick<LoopSummary, 'state' | 'lanes' | 'shipped'>): boolean {
  return loop.state === 'done' && loop.lanes !== undefined && loop.lanes.length > 0 && !loop.shipped;
}

/** One thing that needs the owner. `inbox` items come from the server's inbox; the rest are worked out from the loop summaries. */
type InboxLike = Pick<InboxItem, 'loopId' | 'kind'>;

export type AttentionItem<I extends InboxLike = InboxItem> =
  | { kind: 'inbox'; loopId: string; item: I }
  | { kind: 'lane'; loopId: string; lane: LaneStatus }
  | { kind: 'failing'; loopId: string }
  | { kind: 'release'; loopId: string };

/**
 * The one attention list: the banner count, the nav badge and the Needs-you rows all read it, so they cannot disagree.
 * Per loop: its lane problems, else 1 for a failing loop or a waiting release. A blocked lane or a waiting release that the
 * inbox already lists for that loop is not listed twice.
 */
export function attentionItems<I extends InboxLike>(loops: LoopSummary[], inbox: I[]): AttentionItem<I>[] {
  const items: AttentionItem<I>[] = inbox.map((item) => ({ kind: 'inbox', loopId: item.loopId, item }));
  for (const l of loops) {
    const mine = inbox.filter((i) => i.loopId === l.id);
    const lanes = lanesNeedingYou(l.lanes).filter((x) => !(mine.length > 0 && x.state === 'blocked'));
    if (lanes.length > 0) items.push(...lanes.map((lane): AttentionItem<I> => ({ kind: 'lane', loopId: l.id, lane })));
    else if (l.state === 'failing') items.push({ kind: 'failing', loopId: l.id });
    else if (releaseWaiting(l) && !mine.some((i) => i.kind === 'release')) items.push({ kind: 'release', loopId: l.id });
  }
  return items;
}

/** The "Needs you" total; see `attentionItems`. */
export function needsYouCount(loops: LoopSummary[], inbox: InboxLike[]): number {
  return attentionItems(loops, inbox).length;
}

/** "web → server: …" for one unanswered message. */
export function describeUnanswered(u: { from: string; to: string; text: string }): string {
  return `${u.from} → ${u.to}: ${u.text}`;
}

/** "name · expires 16:30 UTC" for a claimed lane, "Unclaimed" otherwise. */
export function claimText(claim: { name: string; expiresAt: string } | undefined): string {
  return claim ? `${claim.name} · expires ${claim.expiresAt.slice(11, 16)} UTC` : 'Unclaimed';
}

/** One sentence for an attention item the server's inbox does not hold (the Inbox page lists these under the questions). */
export function describeAttention(item: Exclude<AttentionItem, { kind: 'inbox' }>, loop: Pick<LoopSummary, 'reason'> | undefined): string {
  switch (item.kind) {
    case 'lane': return item.lane.state === 'stalled' ? `Lane ${item.lane.name} is stalled` : item.lane.state === 'blocked' ? `Lane ${item.lane.name} is blocked` : `Lane ${item.lane.name} waits on a finished lane`;
    case 'failing': return `Failing${loop?.reason ? ` · ${loop.reason}` : ''}`;
    case 'release': return 'Round done · release waiting on you';
  }
}
