import type { HealthCheck, InboxItem, LoopDetail, LoopSummary } from '../../../src/core/types.js';

/** The live copy of a loop replaces the snapshot's copy of the same id, and goes first. */
export function mergeLoops(snapshot: LoopSummary[], live: LoopDetail | undefined, checks: HealthCheck[] = []): LoopSummary[] {
  if (!live) return snapshot;
  const ci = checks.find((c) => c.loopId === live.id && c.kind === 'failing-tests' && c.state !== 'unchecked');
  const demoUrl = pagesUrl(live.url);
  const card: LoopSummary = { ...live, ...(ci && { ci: { ok: ci.ok, reason: ci.reason } }), ...(demoUrl && { demoUrl }) };
  return [card, ...snapshot.filter((l) => l.id !== live.id)];
}

/** `https://github.com/owner/repo` -> `https://owner.github.io/repo/` (GitHub Pages default); undefined for anything else. */
export function pagesUrl(repoUrl: string | undefined): string | undefined {
  const m = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/?$/.exec(repoUrl ?? '');
  return m ? `https://${(m[1] as string).toLowerCase()}.github.io/${m[2]}/` : undefined;
}

/** Inbox items and checks for the live loop come from GitHub; every other loop keeps its snapshot rows. */
export function mergeFacts<T extends InboxItem | HealthCheck>(snapshot: T[], liveId: string | undefined, live: T[]): T[] {
  return liveId === undefined ? snapshot : [...live, ...snapshot.filter((x) => x.loopId !== liveId)];
}
