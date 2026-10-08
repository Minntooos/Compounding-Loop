import { AlertTriangle, CheckCircle2, Clock, Hammer, OctagonAlert } from 'lucide-react';
import type { LoopState } from '@core/types';
import { STATE_LABEL } from '../lib/format';

const ICON = { failing: OctagonAlert, blocked: AlertTriangle, building: Hammer, waiting: Clock, done: CheckCircle2 } as const;
const COLOR: Record<LoopState, string> = {
  failing: 'var(--failing)', blocked: 'var(--blocked)', building: 'var(--building)', waiting: 'var(--muted)', done: 'var(--done)',
};

// Status is word + icon + colour, never colour alone.
export function StatusBadge({ state }: { state: LoopState }) {
  const Icon = ICON[state];
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: COLOR[state] }}>
      <Icon aria-hidden size={15} />{STATE_LABEL[state]}
    </span>
  );
}
