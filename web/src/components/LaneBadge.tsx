import { AlarmClock, AlertTriangle, CheckCircle2, Clock, Hammer, Moon, Pause, PauseCircle } from 'lucide-react';
import type { LaneState } from '@core/types';
import { LANE_LABEL } from '../lib/lanes';
import type { LaneHold } from '../lib/schedule';

const ICON = { building: Hammer, waiting: Clock, blocked: AlertTriangle, done: CheckCircle2, stalled: PauseCircle } as const;
const COLOR: Record<LaneState, string> = {
  building: 'var(--building)', waiting: 'var(--muted)', blocked: 'var(--blocked)', done: 'var(--done)', stalled: 'var(--failing)',
};
// Pause bars mean paused everywhere (DESIGN §12 heat map); sleeping and snoozed use the strip's glyphs.
const HOLD = {
  'loop-paused': { Icon: Pause, word: 'Paused' }, paused: { Icon: Pause, word: 'Paused' },
  sleeping: { Icon: Moon, word: 'Sleeping' }, snoozed: { Icon: AlarmClock, word: 'Snoozed' },
} as const;

/**
 * State word + icon + colour, never colour alone. `compact` hides the word visually but keeps it for screen readers.
 * `hold` (from `laneHold`) replaces Building/Waiting when the schedule holds the lane back.
 */
export function LaneBadge({ state, compact = false, hold }: { state: LaneState; compact?: boolean; hold?: LaneHold | undefined }) {
  const { Icon, word } = hold ? HOLD[hold] : { Icon: ICON[state], word: LANE_LABEL[state] };
  return (
    <span data-testid="lane-badge" className="inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: hold ? 'var(--muted)' : COLOR[state] }}>
      <Icon aria-hidden size={compact ? 14 : 15} /><span className={compact ? 'sr-only' : undefined}>{word}</span>
    </span>
  );
}
