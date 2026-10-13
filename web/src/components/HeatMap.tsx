import { useState } from 'react';
import type { LoopRun } from '@core/types';
import { HEAT_LABEL, HEAT_ORDER, QUIET_OUTCOMES, heatCellHref, heatCellLabel, heatGrid, type HeatCell, type HeatOutcome } from '../lib/heatmap';
import { laneColor, timeUtc } from '../lib/timeline';
import { useScrollFade } from './useScrollFade';

/** Fill + inner glyph per outcome (DESIGN §12 C3): the shape carries the meaning, colour only repeats it. */
export function HeatGlyph({ outcome, size = 20 }: { outcome: HeatOutcome; size?: number }) {
  const box = { x: 1, y: 1, width: 18, height: 18, rx: 4 };
  const ink = { stroke: 'var(--bg)', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const line = { stroke: 'var(--muted)', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 20 20" data-outcome={outcome} className="block shrink-0">
      {outcome === 'worked' && <><rect {...box} fill="var(--done)" /><path d="M6 10.5l2.6 2.6L14 7.5" {...ink} /></>}
      {outcome === 'idle' && <><rect {...box} fill="var(--surface-2)" stroke="var(--border)" /><circle cx="10" cy="10" r="3.5" {...line} /></>}
      {outcome === 'not-due' && <rect {...box} fill="none" stroke="var(--muted)" strokeWidth={1} strokeDasharray="1.5 2" />}
      {outcome === 'running' && <><rect {...box} fill="none" stroke="var(--building)" strokeWidth={1.5} /><circle cx="10" cy="10" r="4" fill="none" stroke="var(--building)" strokeWidth={1.5} /><path d="M10 6a4 4 0 0 1 0 8z" fill="var(--building)" /></>}
      {outcome === 'limit-stop' && <><rect {...box} fill="var(--blocked)" /><path d="M6.5 13.5l7-7" {...ink} /></>}
      {outcome === 'failed' && <><rect {...box} fill="var(--failing)" /><path d="M7 7l6 6M13 7l-6 6" {...ink} /></>}
      {outcome === 'paused' && <><rect {...box} fill="var(--surface-2)" stroke="var(--muted)" strokeWidth={1} /><path d="M8 6.5v7M12 6.5v7" {...line} strokeWidth={2} /></>}
      {outcome === 'done' && <><rect {...box} fill="none" stroke="var(--muted)" strokeWidth={1} /><path d="M6 10.5l2.6 2.6L14 7.5" {...line} /></>}
    </svg>
  );
}

/** The newest 12 columns stay at 375 px unless the owner asks for all 24 (DESIGN §12: fold to 12 h). */
const FOLD = 12;

/**
 * Lane × hour grid of the last 24 h of expected slots. Each cell links to its slot in the Runs tab; hovering or focusing a
 * cell shows its words in the readout line under the grid. Lane names and run data come from repo files: text nodes only.
 */
export function HeatMap({ loopId, runs, now, lanes, onPick }: { loopId: string; runs: LoopRun[]; now: Date; lanes?: string[]; onPick?: () => void }) {
  const [all, setAll] = useState(false);
  const [hover, setHover] = useState<HeatCell | null>(null);
  const fade = useScrollFade<HTMLDivElement>(all);
  const grid = heatGrid(runs, now, 24, lanes);
  if (grid.rows.length === 0) return null;
  const folded = (i: number) => (!all && i < grid.hours.length - FOLD ? 'hidden sm:table-cell' : '');
  const newest = grid.rows.flatMap((r) => r.cells).filter((c): c is HeatCell => c !== null && !QUIET_OUTCOMES.has(c.outcome)).sort((a, b) => b.run.at.localeCompare(a.run.at))[0];
  const readout = hover ?? newest;
  return (
    <section aria-labelledby="heatmap-title" data-testid="heatmap" className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="heatmap-title" className="text-[13px] font-semibold">Runs, last 24 h</h3>
        <button type="button" aria-pressed={all} onClick={() => setAll((v) => !v)} className="min-h-11 rounded px-2 text-[13px] underline sm:hidden" style={{ color: 'var(--accent)' }}>
          {all ? 'Show 12 h' : 'Show 24 h'}
        </button>
      </div>
      <div ref={fade.ref} onScroll={fade.onScroll} onFocus={fade.onFocus} className="max-w-full overflow-x-auto" style={fade.style}>
        <table className="border-separate [border-spacing:2px]" onMouseLeave={() => setHover(null)}>
          <caption className="sr-only">Lane runs by hour, last 24 hours, newest on the right. Each cell links to that run.</caption>
          <thead>
            <tr>
              <th scope="col" className="w-6 sm:w-auto"><span className="sr-only">Lane</span></th>
              {grid.hours.map((h, i) => (
                <th key={h} scope="col" className={`w-5 p-0 text-center align-bottom font-mono text-[10px] font-normal ${folded(i)}`} style={{ color: 'var(--muted)' }}>
                  <span aria-hidden>{(grid.hours.length - 1 - i) % 6 === 0 ? h.slice(11, 13) : ''}</span>
                  <span className="sr-only">{timeUtc(h)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row) => (
              <tr key={row.lane}>
                <th scope="row" className="pr-2 text-left text-[13px] font-normal">
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: laneColor(row.lane) }} />
                    <span aria-hidden className="font-mono sm:hidden">{row.lane.slice(0, 1)}</span>
                    <span className="sr-only sm:not-sr-only">{row.lane}</span>
                  </span>
                </th>
                {row.cells.map((cell, i) => (
                  <td key={grid.hours[i]} className={`h-5 w-5 p-0 ${folded(i)}`}>
                    {cell && (
                      <a href={heatCellHref(loopId, cell.run)} aria-label={heatCellLabel(cell)} data-testid="heat-cell"
                        onClick={onPick} onMouseEnter={() => setHover(cell)} onFocus={() => setHover(cell)} onBlur={() => setHover(null)}
                        className="block rounded focus-visible:outline-2 focus-visible:outline-offset-1" style={{ outlineColor: 'var(--accent)' }}>
                        <HeatGlyph outcome={cell.outcome} />
                      </a>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p data-testid="heat-readout" className="min-h-5 font-mono text-[12px] [overflow-wrap:anywhere]" style={{ color: hover ? 'var(--text)' : 'var(--muted)' }}>
        {readout && (hover ? heatCellLabel(readout) : `Newest: ${heatCellLabel(readout)}`)}
      </p>
      <ul aria-label="Legend" data-testid="heat-legend" className="flex flex-wrap gap-x-3 gap-y-1 text-[12px]" style={{ color: 'var(--muted)' }}>
        {HEAT_ORDER.map((o) => (
          <li key={o} className="inline-flex items-center gap-1"><HeatGlyph outcome={o} size={14} />{HEAT_LABEL[o]}</li>
        ))}
      </ul>
    </section>
  );
}
