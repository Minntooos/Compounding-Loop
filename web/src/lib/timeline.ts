import type { LoopCommit } from '../../../src/core/types.js';

const PREFIX = /^([a-z][a-z0-9-]*)(?::|\s)/;
const KNOWN = ['core', 'kit', 'server', 'web', 'docs'];

/** Lane of a commit: a known lane name or "control" as the subject's prefix ("web: …"), else "other". */
export function laneOfCommit(message: string): string {
  const name = PREFIX.exec(message)?.[1];
  if (!name) return 'other';
  return name === 'control' || (KNOWN.includes(name) && message.startsWith(`${name}:`)) ? name : 'other';
}

/** CSS colour token for a lane; control room and anything unknown share the quiet one. */
export function laneColor(lane: string): string {
  return KNOWN.includes(lane) ? `var(--lane-${lane})` : 'var(--lane-other)';
}

export interface DayGroup { day: string; commits: LoopCommit[] }

/** Commits grouped by UTC day, newest day first; order inside a day is kept. */
export function groupByDay(commits: LoopCommit[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const c of commits) {
    const day = c.at.slice(0, 10);
    const last = groups[groups.length - 1];
    if (last?.day === day) last.commits.push(c);
    else groups.push({ day, commits: [c] });
  }
  return groups;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Sun 11 Oct" for a YYYY-MM-DD day. */
export function dayHeading(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "14:05 UTC". */
export function timeUtc(iso: string): string {
  return `${iso.slice(11, 16)} UTC`;
}

/** Lanes present in the commits, in first-seen order of a fixed lane order. */
export function lanesIn(commits: LoopCommit[]): string[] {
  const present = new Set(commits.map((c) => laneOfCommit(c.message)));
  return [...KNOWN, 'control', 'other'].filter((l) => present.has(l));
}
