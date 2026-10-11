import { activityStamp } from './card.js';

const LABELS: Record<string, readonly [pass: string, fail: string]> = {
  leak: ['No leaked text on the live site', 'Leaked text on the live site'],
  'stale-lock': ['No stale session lock', 'Stale session lock'],
  'short-runs': ['Runs last long enough', 'Runs ending too fast'],
  'failing-tests': ['Tests pass', 'Tests failing'],
  'runner-silent': ['Runner is active', 'Runner went quiet'],
};

/** Names the result, never just the check ("Tests pass", not "Tests failing" next to an OK badge). Unknown kinds fall back to the raw kind. */
export function checkLabel(kind: string, ok: boolean): string {
  const pair = LABELS[kind];
  return pair ? pair[ok ? 0 : 1] : kind;
}

const ISO = /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})\b/g;

/** Raw ISO timestamps inside proof or reason text become "11 Oct 14:53 UTC". */
export function humanizeTimes(text: string): string {
  return text.replace(ISO, (iso) => (Number.isNaN(Date.parse(iso)) ? iso : activityStamp(iso)));
}
