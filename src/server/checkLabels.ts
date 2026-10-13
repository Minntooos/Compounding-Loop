// Pure (no Node imports): the words and times the dashboard shows for health checks.
import type { HealthCheck } from '../core/types.js';

const LABELS: Record<HealthCheck['kind'], readonly [pass: string, fail: string]> = {
  leak: ['No leaks', 'Leak found'],
  'stale-lock': ['No stale lock', 'Stale lock'],
  'short-runs': ['Runs do real work', 'Runs end in seconds'],
  'failing-tests': ['Tests pass', 'Tests failing'],
  'runner-silent': ['Runner active', 'Runner silent'],
  'lane-stalled': ['Lanes moving', 'Lane stalled'],
  'lane-waiting-on-finished': ['No lane waits on a finished lane', 'Lane waits on a finished lane'],
};

/** What a check states as its result, never just its name ("Tests failing", not "OK · Tests failing"). */
export function checkLabel(kind: HealthCheck['kind'], ok: boolean): string {
  return LABELS[kind][ok ? 0 : 1];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const two = (n: number) => String(n).padStart(2, '0');

/** `11 Oct 14:53 UTC` for an ISO time; anything that is not a date is returned as given. */
export function formatUtc(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${two(d.getUTCHours())}:${two(d.getUTCMinutes())} UTC`;
}

/** The three-way result: an explicit `state` wins, else it follows `ok`. */
export function checkState(check: { ok: boolean; state?: NonNullable<HealthCheck['state']> }): NonNullable<HealthCheck['state']> {
  return check.state ?? (check.ok ? 'pass' : 'fail');
}

/** Adds the result-stating `label` and the `state` to a check (with or without its `loopId`); an existing label is kept. */
export function withLabel<T extends { kind: HealthCheck['kind']; ok: boolean; label?: string; state?: NonNullable<HealthCheck['state']> }>(check: T): T & { label: string; state: NonNullable<HealthCheck['state']> } {
  const state = checkState(check);
  return { ...check, state, label: check.label ?? (state === 'unchecked' ? 'Not checked' : checkLabel(check.kind, check.ok)) };
}
