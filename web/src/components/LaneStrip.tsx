import type { LaneStatus } from '@core/types';
import { LaneBadge } from './LaneBadge';

/** One chip per lane on a Fleet card: icon and lane name; the state word is there for screen readers and the tooltip. */
export function LaneStrip({ lanes }: { lanes: LaneStatus[] }) {
  return (
    <ul aria-label="Lanes" data-testid="lane-strip" className="mt-3 flex flex-wrap gap-1.5">
      {lanes.map((l) => (
        <li key={l.name} data-testid="lane-chip" className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[12px]" style={{ borderColor: 'var(--border)' }}>
          <LaneBadge state={l.state} compact /><span>{l.name}</span>
        </li>
      ))}
    </ul>
  );
}
