import type { LoopState } from '@core/types';

export const STATE_LABEL: Record<LoopState, string> = {
  failing: 'Failing', blocked: 'Blocked', building: 'Building', waiting: 'Waiting', done: 'Done',
};

/** Compact "in 2h" / "3d ago" phrasing; `now` is injectable so it stays pure. */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const diff = Date.parse(iso) - now;
  const mins = Math.round(Math.abs(diff) / 60_000);
  const text = mins < 60 ? `${mins}m` : mins < 60 * 48 ? `${Math.round(mins / 60)}h` : `${Math.round(mins / 1440)}d`;
  return diff >= 0 ? `in ${text}` : `${text} ago`;
}
