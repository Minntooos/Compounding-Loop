import type { LoopSummary } from '@core/types';
import { chipHold } from '../lib/card';
import { LaneBadge } from './LaneBadge';

/** One chip per lane on a Fleet card: icon and lane name; the state word is there for screen readers and the tooltip. */
export function LaneStrip({ loop }: { loop: Pick<LoopSummary, 'paused' | 'runOutcomes'> & { lanes: NonNullable<LoopSummary['lanes']> } }) {
  const { lanes } = loop;
  return (
    <ul aria-label="Lanes" data-testid="lane-strip" className="mt-3 flex flex-wrap gap-1.5">
      {lanes.map((l) => (
        <li key={l.name} data-testid="lane-chip" className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[12px]" style={{ borderColor: 'var(--border)' }}>
          <LaneBadge state={l.state} hold={chipHold(loop, l)} compact /><span>{l.name}</span>
        </li>
      ))}
    </ul>
  );
}
