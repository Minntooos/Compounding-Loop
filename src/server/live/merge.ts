// Pure: joins the bundled snapshot's commit history with the commits fetched live since its head.
import type { LoopCommit } from '../../core/types.js';

/** The commit date to pass as `since` for the live fetch: the newest commit in the snapshot. */
export function snapshotSince(snapshot: readonly LoopCommit[]): string | undefined {
  return snapshot.reduce<string | undefined>((newest, c) => (newest === undefined || c.at > newest ? c.at : newest), undefined);
}

/**
 * Newest first, one entry per commit. A commit in both lists keeps the live copy (it is the fresher read) and only
 * the fields shown to people.
 */
export function mergeCommits(snapshot: readonly LoopCommit[], live: readonly LoopCommit[]): LoopCommit[] {
  const bySha = new Map<string, LoopCommit>();
  for (const c of [...snapshot, ...live]) bySha.set(c.sha, { sha: c.sha, at: c.at, message: c.message, ...(c.author && { author: c.author }), ...(c.lane && { lane: c.lane }) });
  // Array.prototype.sort is stable, so equal timestamps keep their insertion order.
  return [...bySha.values()].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}
