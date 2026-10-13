import type { HealthCheck } from '../../../src/core/types.js';
import { activityStamp } from './card.js';

export type CheckState = NonNullable<HealthCheck['state']>;

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

/** What a check measures, for a row that was never measured ("Test results: not checked"). */
const NAMES: Record<string, string> = {
  leak: 'Leaked text on the live site',
  'stale-lock': 'Session lock',
  'short-runs': 'Run length',
  'failing-tests': 'Test results',
  'runner-silent': 'Runner activity',
  'lane-stalled': 'Lane activity',
  'lane-waiting-on-finished': 'Lane waits',
};

/** pass, fail or unchecked: the server's `state` wins; a check without one (older server, demo snapshot) follows `ok`. */
export function checkState(check: Pick<HealthCheck, 'ok' | 'state'>): CheckState {
  return check.state ?? (check.ok ? 'pass' : 'fail');
}

/** The row's sentence: the result for a measured check, what it would measure for an unchecked one. */
export function checkText(check: Pick<HealthCheck, 'kind' | 'ok' | 'state' | 'label'>): string {
  if (checkState(check) === 'unchecked') return `${NAMES[check.kind] ?? check.kind}: not checked yet`;
  return check.label ?? checkLabel(check.kind, check.ok);
}

/** "3 pass · 1 failing · 2 not checked": an unmeasured check never counts as a pass. Empty parts are left out. */
export function checkSummary(checks: readonly Pick<HealthCheck, 'ok' | 'state'>[]): string {
  const count = (s: CheckState) => checks.filter((c) => checkState(c) === s).length;
  const parts: [number, string][] = [[count('fail'), 'failing'], [count('pass'), 'pass'], [count('unchecked'), 'not checked']];
  return parts.filter(([n]) => n > 0).map(([n, w]) => `${n} ${w}`).join(' · ');
}

/** Splits `code` spans out of a hint so they render as <code> (React text, never HTML). Odd parts are code; an unpaired backtick leaves the text whole. */
export function codeParts(text: string): string[] {
  const parts = text.split('`');
  return parts.length % 2 === 1 ? parts : [text];
}

const ISO = /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})\b/g;

/** Raw ISO timestamps inside proof or reason text become "11 Oct 14:53 UTC". */
export function humanizeTimes(text: string): string {
  return text.replace(ISO, (iso) => (Number.isNaN(Date.parse(iso)) ? iso : activityStamp(iso)));
}
