import { AlertTriangle, CheckCircle2, Clock, Hammer, OctagonAlert } from 'lucide-react';
import type { LoopState } from '@core/types';
import { STATE_LABEL } from '../lib/format';
import type { CardBadge } from '../lib/card';

const ICON = { failing: OctagonAlert, blocked: AlertTriangle, building: Hammer, waiting: Clock, done: CheckCircle2, stalled: AlertTriangle } as const;
const COLOR: Record<CardBadge, string> = {
  failing: 'var(--failing)', blocked: 'var(--blocked)', building: 'var(--building)', waiting: 'var(--muted)', done: 'var(--done)', stalled: 'var(--blocked)',
};
const LABEL: Record<CardBadge, string> = { ...STATE_LABEL, stalled: 'Stalled' } satisfies Record<LoopState | 'stalled', string>;

// Status is word + icon + colour, never colour alone. Stalled uses the strip's tone and glyph for the same state.
export function StatusBadge({ state }: { state: CardBadge }) {
  const Icon = ICON[state];
  return (
    <span data-testid="status-badge" className="inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: COLOR[state] }}>
      <Icon aria-hidden size={15} />{LABEL[state]}
    </span>
  );
}
