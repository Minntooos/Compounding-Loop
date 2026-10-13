import type { LoopRun } from '../../../src/core/types.js';
import { QUIET_KINDS } from '../../../src/server/live/index.js';
import { dayHeading, timeUtc } from './timeline.js';

export type RunOutcome = LoopRun['outcome'];

/** Missing scheduled slots in a row (newest first) at which the tab warns; matches the server's attention item. */
export const SILENT_THRESHOLD = 3;

/** Runs and missed slots only: drops the server's quiet slots (not-due, paused, done), which are not missing runs. */
export function listedRuns(runs: LoopRun[]): LoopRun[] {
  return runs.filter((r) => !(r.kind && QUIET_KINDS.has(r.kind)));
}

/** Runs of the selected lanes (all when none is selected), order kept. */
export function filterRuns(runs: LoopRun[], selected: ReadonlySet<string>): LoopRun[] {
  return selected.size === 0 ? runs : runs.filter((r) => selected.has(r.lane));
}

/** Lanes that have at least `threshold` missed slots in a row, newest first. */
export function silentLanes(runs: LoopRun[], threshold = SILENT_THRESHOLD): string[] {
  const lanes = [...new Set(runs.map((r) => r.lane))];
  return lanes.filter((lane) => {
    let streak = 0;
    for (const r of runs) {
      if (r.lane !== lane) continue;
      // A missed slot: core's `missed` kind, or no run line when the server sent no kind (never a running or quiet slot).
      if (r.kind ? r.kind !== 'missed' : r.outcome !== 'no-run-recorded') break;
      streak += 1;
    }
    return streak >= threshold;
  });
}

/** Runs grouped by UTC day of their `at`, newest day first. */
export function groupRunsByDay(runs: LoopRun[]): { day: string; runs: LoopRun[] }[] {
  const groups: { day: string; runs: LoopRun[] }[] = [];
  for (const r of runs) {
    const day = r.at.slice(0, 10);
    const last = groups[groups.length - 1];
    if (last?.day === day) last.runs.push(r);
    else groups.push({ day, runs: [r] });
  }
  return groups;
}

/** "3 passed" / "2 failed" for a run's test result, undefined without one. */
export function testsText(tests: LoopRun['tests']): string | undefined {
  if (!tests) return undefined;
  return tests.failed > 0 ? `${tests.failed} failed, ${tests.passed} passed` : `${tests.passed} passed`;
}

export interface TestPoint { at: string; lane?: string; passed: number; failed: number }

/** Runs that recorded a test result, oldest first (the chart's x order). */
export function testSeries(runs: LoopRun[]): TestPoint[] {
  return runs
    .filter((r): r is LoopRun & { tests: { passed: number; failed: number } } => r.tests !== undefined)
    .map((r) => ({ at: r.at, lane: r.lane, passed: r.tests.passed, failed: r.tests.failed }))
    .sort((a, b) => a.at.localeCompare(b.at));
}

/** Newest point with failing tests, undefined when every recorded run passed. */
export function lastFailure(series: TestPoint[]): TestPoint | undefined {
  return [...series].reverse().find((p) => p.failed > 0);
}

/** "Sun 11 Oct 14:53 UTC" for a test result; `timeUtc` already ends in "UTC" (A4: it once read "UTC UTC"). */
export function testStamp(at: string): string {
  return `${dayHeading(at.slice(0, 10))} ${timeUtc(at)}`;
}
