import type { LoopSummary } from '../../../src/core/types.js';

/** The loop that is this repo building itself; the fleet shows it first. */
export const SELF_BUILD_ID = 'compounding-loop';

/** Self-build card first, everything else keeps its (attention) order. */
export function selfFirst<T extends { id: string }>(loops: T[]): T[] {
  return [...loops.filter((l) => l.id === SELF_BUILD_ID), ...loops.filter((l) => l.id !== SELF_BUILD_ID)];
}

/** Round progress for the card: "Round 2 of 3", or "Round 2 of 2 done" once the loop is finished. */
export function roundProgress(loop: Pick<LoopSummary, 'round' | 'roundsTotal' | 'state'>): { value: number; max: number; text: string } {
  const max = Math.max(loop.roundsTotal, 1);
  const value = Math.min(Math.max(loop.round, 0), max);
  return { value, max, text: `Round ${value} of ${max}${loop.state === 'done' ? ' done' : ''}` };
}

/** Run-budget progress: "15 of 150 runs". */
export function runBudget(loop: Pick<LoopSummary, 'run' | 'runLimit'>): { value: number; max: number; text: string } {
  const max = Math.max(loop.runLimit, 1);
  const value = Math.min(Math.max(loop.run, 0), max);
  return { value, max, text: `${value} of ${loop.runLimit} runs` };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "11 Oct 14:05 UTC": absolute, so it does not rot in a static snapshot. */
export function activityStamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()] ?? ''} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

/** Facts worth a row on a card. Rows without data are left out instead of printed as "no result". */
export function cardFacts(loop: Pick<LoopSummary, 'tests' | 'live' | 'lastCommit' | 'nextRunAt'>): { label: string; value: string }[] {
  const facts: { label: string; value: string }[] = [];
  if (loop.lastCommit) facts.push({ label: 'Last activity', value: activityStamp(loop.lastCommit.at) });
  if (loop.tests) facts.push({ label: 'Tests', value: `${loop.tests.passed} passed${loop.tests.failed ? `, ${loop.tests.failed} failed` : ''}` });
  if (loop.live) facts.push({ label: 'Live site', value: loop.live.ok ? `up (${loop.live.status})` : `down (${loop.live.status})` });
  return facts;
}
