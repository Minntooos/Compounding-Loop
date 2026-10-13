import { AlertTriangle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { LoopRun } from '@core/types';
import { dayHeading, laneColor, timeUtc } from '../lib/timeline';
import { HEAT_HINT, HEAT_LABEL, heatCellLabel, heatOutcome, type HeatOutcome } from '../lib/heatmap';
import type { RunFocus } from '../lib/route';
import { HeatGlyph, HeatMap } from './HeatMap';
import { filterRuns, groupRunsByDay, listedRuns, silentLanes, testsText } from '../lib/runs';

// Same words and glyphs as the heat map (DESIGN §12 C3); the text colour repeats the glyph, never replaces it.
const COLOR: Record<HeatOutcome, string> = {
  worked: 'var(--done)', idle: 'var(--muted)', 'not-due': 'var(--muted)', running: 'var(--building)',
  'limit-stop': 'var(--blocked)', failed: 'var(--failing)', paused: 'var(--muted)', done: 'var(--muted)',
};
const sentence = (o: HeatOutcome) => HEAT_LABEL[o].charAt(0).toUpperCase() + HEAT_LABEL[o].slice(1);

// Lane names, units and notes come from repo files: rendered as text nodes only.
function RunRow({ run, picked }: { run: LoopRun; picked: boolean }) {
  const ref = useRef<HTMLLIElement>(null);
  // Opened from a heat-map cell: bring the slot into view once, without stealing focus from the page.
  useEffect(() => { if (picked) ref.current?.scrollIntoView({ block: 'center' }); }, [picked]);
  const outcome = heatOutcome(run);
  const tests = testsText(run.tests);
  const hint = HEAT_HINT[outcome];
  return (
    <li ref={ref} data-testid="run-row" data-outcome={outcome} aria-current={picked ? 'true' : undefined} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-r border-l-[3px] py-1 pl-3" style={{ borderColor: laneColor(run.lane), ...(picked && { background: 'var(--surface-2)', outline: '1px solid var(--accent)' }) }}>
      <span className="font-mono text-[12px]" style={{ color: laneColor(run.lane) }}>{run.lane}</span>
      <time dateTime={run.at} className="font-mono text-[12px] tabular-nums" style={{ color: 'var(--muted)' }}>{timeUtc(run.at)}</time>
      <span className="inline-flex items-center gap-1.5 self-center text-[13px] font-medium" style={{ color: COLOR[outcome] }}>
        <HeatGlyph outcome={outcome} size={15} />{sentence(outcome)}
      </span>
      {hint && <span className="text-[12px]" style={{ color: 'var(--muted)' }}>{hint}</span>}
      {run.units.length > 0 && <span className="min-w-0 [overflow-wrap:anywhere]">{run.units.join(', ')}</span>}
      {run.commits.length > 0 && <span className="text-[12px]" style={{ color: 'var(--muted)' }}>{run.commits.length} {run.commits.length === 1 ? 'commit' : 'commits'}</span>}
      {tests && <span className="font-mono text-[12px]" style={{ color: run.tests && run.tests.failed > 0 ? 'var(--failing)' : 'var(--muted)' }}>{tests}</span>}
      {run.note && <span className="basis-full text-[12px] [overflow-wrap:anywhere]" style={{ color: 'var(--muted)' }}>{run.note}</span>}
    </li>
  );
}

/** `quiet` lanes (done or blocked) and a paused loop never raise the notice: their missed slots are expected (same guards as the server's attention item). */
export function RunsTab({ runs: slots, nextRuns, quiet = [], paused = false, heat, focus }: {
  runs: LoopRun[]; nextRuns?: { lane: string; at: string }[]; quiet?: string[]; paused?: boolean;
  /** Heat map at the head of the tab (C3): the loop it links into, the clock it is read at and the lane order. */
  heat?: { loopId: string; now: Date; lanes?: string[]; onPick?: () => void };
  focus?: RunFocus;
}) {
  const [active, setActive] = useState<ReadonlySet<string>>(new Set());
  const focusKey = focus && `${focus.lane}@${focus.at}`;
  // A picked slot must not hide behind a lane filter.
  useEffect(() => { if (focusKey) setActive(new Set()); }, [focusKey]);
  const isFocus = (r: LoopRun) => focus !== undefined && r.lane === focus.lane && r.at === focus.at;
  const quietPick = focus && slots.find((r) => isFocus(r) && !listedRuns([r]).length);
  const runs = listedRuns(slots);
  const lanes = [...new Set(runs.map((r) => r.lane))];
  const shown = filterRuns(runs, active);
  const silent = paused ? [] : silentLanes(runs).filter((l) => !quiet.includes(l));
  const toggle = (lane: string) => setActive((prev) => { const next = new Set(prev); if (!next.delete(lane)) next.add(lane); return next; });
  const heatMap = heat && <HeatMap loopId={heat.loopId} runs={slots} now={heat.now} {...(heat.lanes && { lanes: heat.lanes })} {...(heat.onPick && { onPick: heat.onPick })} />;
  if (runs.length === 0) return <div className="space-y-4">{heatMap}<p style={{ color: 'var(--muted)' }}>No runs recorded yet. Runners call <code className="font-mono">loop runs log</code> at the end of each run.</p></div>;
  return (
    <div className="space-y-4">
      {heatMap}
      {quietPick && <p data-testid="runs-picked-quiet" className="text-[13px]" style={{ color: 'var(--muted)' }}>{heatCellLabel({ run: quietPick, outcome: heatOutcome(quietPick) })}: no run was expected in that slot.</p>}
      {silent.length > 0 && (
        <p role="status" data-testid="runs-silent" className="flex items-start gap-2 rounded-lg border p-3" style={{ borderColor: 'var(--blocked)', background: 'var(--surface)' }}>
          <AlertTriangle aria-hidden size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--blocked)' }} />
          <span>Lanes are not running ({silent.join(', ')}): check your plan's usage limit.</span>
        </p>
      )}
      {nextRuns && nextRuns.length > 0 && (
        <p className="text-[13px]" style={{ color: 'var(--muted)' }}>Next scheduled: {nextRuns.map((n) => `${n.lane} ${timeUtc(n.at)}`).join(' · ')}</p>
      )}
      {lanes.length > 1 && (
        <div role="group" aria-label="Filter runs by lane" className="flex gap-1.5 overflow-x-auto pb-1">
          <button type="button" aria-pressed={active.size === 0} onClick={() => setActive(new Set())} className="shrink-0 rounded-full border px-3 py-1 text-[13px] min-h-11 sm:min-h-8 aria-pressed:font-semibold aria-pressed:underline" style={{ borderColor: 'var(--border)' }}>All</button>
          {lanes.map((l) => (
            <button key={l} type="button" aria-pressed={active.has(l)} onClick={() => toggle(l)} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] min-h-11 sm:min-h-8 aria-pressed:font-semibold aria-pressed:underline" style={{ borderColor: 'var(--border)' }}>
              <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: laneColor(l) }} />{l}
            </button>
          ))}
        </div>
      )}
      <div className="space-y-5" data-testid="runs">
        {groupRunsByDay(shown).map((g) => (
          <section key={g.day} aria-label={dayHeading(g.day)}>
            <h3 className="sticky top-0 z-10 flex items-baseline gap-2 py-1 text-[13px] font-semibold" style={{ background: 'var(--bg)' }}>
              {dayHeading(g.day)}<span className="font-normal" style={{ color: 'var(--muted)' }}>{g.runs.length} {g.runs.length === 1 ? 'run' : 'runs'}</span>
            </h3>
            <ol className="space-y-1">{g.runs.map((r, i) => <RunRow key={`${r.lane}-${r.at}-${i}`} run={r} picked={isFocus(r)} />)}</ol>
          </section>
        ))}
      </div>
    </div>
  );
}
