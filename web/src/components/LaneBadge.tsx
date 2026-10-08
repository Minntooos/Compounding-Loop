import { AlertTriangle, CheckCircle2, Clock, Hammer, PauseCircle } from 'lucide-react';
import type { LaneState } from '@core/types';
import { LANE_LABEL } from '../lib/lanes';

const ICON = { building: Hammer, waiting: Clock, blocked: AlertTriangle, done: CheckCircle2, stalled: PauseCircle } as const;
const COLOR: Record<LaneState, string> = {
  building: 'var(--building)', waiting: 'var(--muted)', blocked: 'var(--blocked)', done: 'var(--done)', stalled: 'var(--failing)',
};

/** State word + icon + colour, never colour alone. `compact` hides the word visually but keeps it for screen readers. */
export function LaneBadge({ state, compact = false }: { state: LaneState; compact?: boolean }) {
  const Icon = ICON[state];
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: COLOR[state] }}>
      <Icon aria-hidden size={compact ? 14 : 15} /><span className={compact ? 'sr-only' : undefined}>{LANE_LABEL[state]}</span>
    </span>
  );
}
