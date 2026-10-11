import type { LoopRun } from '../../../src/core/types.js';

export type RunOutcome = LoopRun['outcome'];

export const OUTCOME_LABEL: Record<RunOutcome, string> = {
  pushed: 'Pushed',
  'nothing-pushed': 'Ran, pushed nothing',
  'tests-failed': 'Tests failed',
  'no-run-recorded': 'No run recorded',
};

/** Detail line under an outcome that needs an explanation. */
export const OUTCOME_HINT: Partial<Record<RunOutcome, string>> = {
  'no-run-recorded': 'usage limit, idle or failed',
};

/** Missing scheduled slots in a row (newest first) at which the tab warns; matches the server's attention item. */
export const SILENT_THRESHOLD = 3;

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
      if (r.outcome !== 'no-run-recorded') break;
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
