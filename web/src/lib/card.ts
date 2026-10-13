import type { LoopSummary } from '../../../src/core/types.js';

/** The loop that is this repo building itself; the fleet shows it first. */
export const SELF_BUILD_ID = 'compounding-loop';

/** Self-build card first, everything else keeps its (attention) order. */
export function selfFirst<T extends { id: string }>(loops: T[]): T[] {
  return [...loops.filter((l) => l.id === SELF_BUILD_ID), ...loops.filter((l) => l.id !== SELF_BUILD_ID)];
}

const count = (n: number) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

/** Round progress: "Round 2 of 3", "Round 2 of 2 done". Text keeps the real numbers; only the bar width is clamped. Undefined without a round total. */
export function roundProgress(loop: Pick<LoopSummary, 'round' | 'roundsTotal' | 'state' | 'shipped'> & { lanes?: unknown[] }): { value: number; max: number; text: string } | undefined {
  const total = count(loop.roundsTotal);
  if (total === 0) return undefined;
  const round = count(loop.round);
  const laned = loop.state === 'done' && loop.lanes?.length;
  const text = laned ? `Round ${round} done · ${loop.shipped ? releasedText(loop.shipped) : 'release waiting on you'}` : `Round ${round} of ${total}${loop.state === 'done' ? ' done' : ''}`;
  return { value: Math.min(round, total), max: total, text };
}

/** "0.4.0 released 13 Oct" (the date is left out when unknown). */
export function releasedText(shipped: NonNullable<LoopSummary['shipped']>): string {
  const d = shipped.date ? new Date(shipped.date) : undefined;
  const day = d && !Number.isNaN(d.getTime()) ? ` ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()] ?? ''}` : '';
  return `${shipped.version} released${day}`;
}

/** Lane progress for a loop that is still building: "2 of 5 lanes done". The round bar would read as finished once round = total. */
export function laneProgress(loop: Pick<LoopSummary, 'lanes' | 'state'>): { value: number; max: number; text: string } | undefined {
  if (!loop.lanes || loop.lanes.length === 0 || loop.state === 'done') return undefined;
  const done = loop.lanes.filter((l) => l.state === 'done').length;
  return { value: done, max: loop.lanes.length, text: `${done} of ${loop.lanes.length} lanes done` };
}

/** Run-budget progress: "15 of 150 runs". Undefined without a limit, without a run yet, or once the loop is done (an empty bar is noise). */
export function runBudget(loop: Pick<LoopSummary, 'run' | 'runLimit'> & { state?: LoopSummary['state'] }): { value: number; max: number; text: string } | undefined {
  const limit = count(loop.runLimit);
  const run = count(loop.run);
  if (limit === 0 || run === 0 || loop.state === 'done') return undefined;
  return { value: Math.min(run, limit), max: limit, text: `${run} of ${limit} runs` };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "11 Oct 14:05 UTC": absolute, so it does not rot in a static snapshot. */
export function activityStamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()] ?? ''} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

/** Facts worth a row on a card. Rows without data are left out instead of printed as "no result". */
export function cardFacts(loop: Pick<LoopSummary, 'tests' | 'live' | 'lastCommit' | 'nextRunAt' | 'ci' | 'demoUrl'> & { snapshotAt?: string }): { label: string; value: string }[] {
  const facts: { label: string; value: string }[] = [];
  // Bundled data never passes for live: say which day it is from.
  if (loop.snapshotAt) { const d = new Date(loop.snapshotAt); facts.push({ label: 'Data', value: `snapshot ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()] ?? ''}` }); }
  if (loop.lastCommit) facts.push({ label: 'Last activity', value: activityStamp(loop.lastCommit.at) });
  if (loop.ci) facts.push({ label: 'CI', value: loop.ci.ok ? 'passing on main' : 'failing on main' });
  if (loop.tests) facts.push({ label: 'Tests', value: `${loop.tests.passed} passed${loop.tests.failed ? `, ${loop.tests.failed} failed` : ''}` });
  if (loop.live) facts.push({ label: 'Live site', value: loop.live.ok ? `up (${loop.live.status})` : `down (${loop.live.status})` });
  if (loop.demoUrl && !loop.live) facts.push({ label: 'Live site', value: loop.demoUrl.replace(/^https:\/\//, '') });
  return facts;
}

const RUN_WORD: Record<NonNullable<LoopSummary['lastRun']>['outcome'], string> = {
  pushed: 'pushed', 'nothing-pushed': 'pushed nothing', 'tests-failed': 'tests failed', 'no-run-recorded': 'no run recorded',
};

/** The card's one status line: a pause wins, else the reason followed by the newest run ("last run 21:44 UTC: pushed"). */
export function statusLine(loop: Pick<LoopSummary, 'reason' | 'paused' | 'lastRun'>): string {
  const { paused, lastRun } = loop;
  if (paused) {
    const since = paused.at ? ` since ${paused.at.slice(11, 16)} UTC` : '';
    return `Paused by ${paused.by}${since}${paused.reason ? ` · ${paused.reason}` : ''}`;
  }
  return lastRun ? `${loop.reason} · last run ${lastRun.at.slice(11, 16)} UTC: ${RUN_WORD[lastRun.outcome]}` : loop.reason;
}

/** The loop header's round text: server's `roundLabel`, else "Round 2/3"; undefined when the status reason already names that round (A8: said once). */
export function headerRound(loop: Pick<LoopSummary, 'round' | 'roundsTotal' | 'reason' | 'roundLabel'>): string | undefined {
  const text = loop.roundLabel ?? (count(loop.roundsTotal) > 0 ? `Round ${count(loop.round)}/${count(loop.roundsTotal)}` : undefined);
  if (!text) return undefined;
  return new RegExp(`\\bround ${count(loop.round)}\\b`, 'i').test(loop.reason) ? undefined : text;
}
