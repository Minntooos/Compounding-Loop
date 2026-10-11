import type { LoopDetail } from '../../../src/core/types.js';

/** A laned loop has no single budget: show the per-lane limit (all lanes alike, else the range). */
export function runLimitText(loop: Pick<LoopDetail, 'runLimit' | 'lanes'>): string {
  const limits = [...new Set((loop.lanes ?? []).map((l) => l.limit).filter((n) => n > 0))].sort((a, b) => a - b);
  if (limits.length === 0) return String(loop.runLimit);
  return limits.length === 1 ? `${limits[0]} per lane` : `${limits[0]}-${limits[limits.length - 1]} per lane`;
}

/** The loop's own site (GitHub Pages demo for the self-build) before the repo URL. */
export function siteOf(loop: Pick<LoopDetail, 'url'> & { demoUrl?: string }): string | undefined {
  return loop.demoUrl ?? loop.url;
}
