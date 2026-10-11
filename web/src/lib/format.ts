import type { LoopState } from '../../../src/core/types.js';

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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "6 Oct" in UTC: absolute and stable, unlike "3d ago" which rots in a static page. */
export function shortDateUtc(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()] ?? ''}`;
}

/** The newest ISO timestamp among a fleet's last commits; `fallback` when none has one. */
export function newestActivity(loops: { lastCommit?: { at: string } }[], fallback: string): string {
  return loops.reduce((best, l) => (l.lastCommit && Date.parse(l.lastCommit.at) > Date.parse(best) ? l.lastCommit.at : best), fallback);
}
