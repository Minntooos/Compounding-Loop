import type { LoopRun } from '../../../src/core/types.js';
import { timeUtc } from './timeline.js';

/** The heat map's words (DESIGN §12 C3, IDEA B3), shared with the legend. */
export type HeatOutcome = 'worked' | 'idle' | 'not-due' | 'running' | 'limit-stop' | 'failed' | 'paused' | 'done';

export const HEAT_LABEL: Record<HeatOutcome, string> = {
  worked: 'worked', idle: 'idle', 'not-due': 'not due', running: 'likely running',
  'limit-stop': 'limit stop', failed: 'failed', paused: 'paused', done: 'done',
};

/** Detail line under a Runs-tab row whose word needs an explanation. */
export const HEAT_HINT: Partial<Record<HeatOutcome, string>> = {
  'limit-stop': 'no run logged: usage limit or a failed start',
  running: 'inside its 50-minute run window',
};

/** Legend order: what ran, then what did not, then expected silence. */
export const HEAT_ORDER: HeatOutcome[] = ['worked', 'idle', 'running', 'failed', 'limit-stop', 'not-due', 'paused', 'done'];

const BY_KIND: Record<NonNullable<LoopRun['kind']>, HeatOutcome> = {
  worked: 'worked', idle: 'idle', 'tests-failed': 'failed', 'not-due': 'not-due', running: 'running', missed: 'limit-stop', paused: 'paused', done: 'done',
};
const BY_OUTCOME: Record<LoopRun['outcome'], HeatOutcome> = {
  pushed: 'worked', 'nothing-pushed': 'idle', 'tests-failed': 'failed', 'no-run-recorded': 'limit-stop',
};

/** Core's slot kind when the server sent one, else the run outcome (older servers and snapshots). */
export function heatOutcome(run: Pick<LoopRun, 'kind' | 'outcome'> & { units?: string[] }): HeatOutcome {
  if (run.kind) return BY_KIND[run.kind];
  // Core counts a run that finished units as worked even when it pushed nothing (src/core/outcomes.ts).
  if (run.outcome === 'nothing-pushed' && (run.units?.length ?? 0) > 0) return 'worked';
  return BY_OUTCOME[run.outcome];
}

const HOUR = 3_600_000;

export interface HeatCell { run: LoopRun; outcome: HeatOutcome }
export interface HeatGrid {
  /** Start of each hour column (ISO), oldest first; the last one holds `now`. */
  hours: string[];
  rows: { lane: string; cells: (HeatCell | null)[] }[];
}

/**
 * One row per lane (in `lanes` order, then any other lane that has a slot), one column per hour of the `hours` hours up to
 * `now`. A lane with two slots in one hour shows the newest; an hour with no slot is null (blank space, not a cell).
 */
export function heatGrid(runs: LoopRun[], now: Date, hours = 24, lanes: string[] = []): HeatGrid {
  const end = Math.floor(now.getTime() / HOUR) * HOUR;
  const start = end - (hours - 1) * HOUR;
  const columns = Array.from({ length: hours }, (_, i) => new Date(start + i * HOUR).toISOString());
  const names = [...new Set([...lanes, ...runs.map((r) => r.lane)])];
  const cells = new Map(names.map((n) => [n, Array<HeatCell | null>(hours).fill(null)]));
  for (const run of runs) {
    const t = new Date(run.at).getTime();
    const i = Math.floor((t - start) / HOUR);
    const row = cells.get(run.lane);
    if (!row || Number.isNaN(t) || i < 0 || i >= hours) continue;
    const prev = row[i];
    // Newest slot wins; at the same moment a recorded run beats a slot with no run line.
    const newer = !prev || Date.parse(prev.run.at) < t || (Date.parse(prev.run.at) === t && prev.run.outcome === 'no-run-recorded' && run.outcome !== 'no-run-recorded');
    if (newer) row[i] = { run, outcome: heatOutcome(run) };
  }
  return { hours: columns, rows: names.map((lane) => ({ lane, cells: cells.get(lane) ?? [] })).filter((r) => r.cells.some(Boolean)) };
}

/** Expected silence: never the readout's "newest" slot. */
export const QUIET_OUTCOMES: ReadonlySet<HeatOutcome> = new Set(['not-due', 'paused', 'done']);

/** "web 14:00 UTC: worked, 2 units" — the cell's aria-label and readout. */
export function heatCellLabel({ run, outcome }: HeatCell): string {
  const units = run.units.length;
  const extra = outcome === 'worked' && units > 0 ? `, ${units} ${units === 1 ? 'unit' : 'units'}`
    : outcome === 'failed' && run.tests ? `, ${run.tests.failed} failing`
    : outcome === 'limit-stop' ? ', no run logged (usage limit or a failed start)' : '';
  return `${run.lane} ${timeUtc(run.at)}: ${HEAT_LABEL[outcome]}${extra}`;
}

/** The Runs-tab link for a cell: the loop page opens on Runs with that slot picked. */
export function heatCellHref(loopId: string, run: Pick<LoopRun, 'lane' | 'at'>): string {
  const q = new URLSearchParams({ tab: 'Runs', run: run.at, lane: run.lane });
  return `#/loop/${encodeURIComponent(loopId)}?${q.toString()}`;
}
