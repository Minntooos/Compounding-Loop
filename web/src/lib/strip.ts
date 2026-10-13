import type { LoopDetail, LoopSummary } from '../../../src/core/types.js';
import { RUN_WINDOW_MS } from '../../../src/core/parse/outcomes.js';
import { activityStamp, releasedText } from './card.js';
import { releaseWaiting } from './lanes.js';

/** Segment 1 of the status strip (DESIGN.md §12), in precedence order: the first one any loop has wins on the fleet. */
export const STRIP_STATES = ['stalled', 'release-waiting', 'paused', 'running', 'likely-running', 'sleeping', 'idle', 'released', 'done'] as const;
export type StripState = (typeof STRIP_STATES)[number];

export const STRIP_STATE_LABEL: Record<StripState, string> = {
  stalled: 'Stalled', 'release-waiting': 'Release waiting', running: 'Running', 'likely-running': 'Likely running', sleeping: 'Sleeping', paused: 'Paused', idle: 'Idle', released: 'Released', done: 'Done',
};

export type Tone = 'done' | 'blocked' | 'failing' | 'building' | 'muted' | 'text';
export type SegmentId = 'state' | 'needs' | 'round' | 'ci' | 'limits' | 'ship' | 'next';

export interface Segment {
  id: SegmentId;
  text: string;
  /** Shorter words for the phone strip, which has two lines for everything (DESIGN.md §12 C1). */
  short?: string;
  tone: Tone;
  /** Icon key; the component maps it to a glyph, so meaning never rests on colour alone. */
  icon: string;
  href?: string;
}

type Summary = Pick<LoopSummary, 'id' | 'name' | 'state' | 'lanes' | 'shipped' | 'paused' | 'lastRun' | 'lastCommit' | 'roundLabel' | 'round' | 'roundsTotal' | 'ci' | 'tests' | 'nextRunAt' | 'runOutcomes'>;
type Detail = Partial<Pick<LoopDetail, 'ship' | 'nextRuns' | 'contract' | 'laneNotes'>>;

const loopHref = (id: string) => `#/loop/${encodeURIComponent(id)}`;

/** The newest sign of work: a run's log line or a commit. */
function lastActivity(loop: Pick<LoopSummary, 'lastRun' | 'lastCommit'>): number {
  const times = [loop.lastRun?.at, loop.lastCommit?.at].map((t) => (t ? new Date(t).getTime() : NaN)).filter((t) => !Number.isNaN(t));
  return times.length ? Math.max(...times) : NaN;
}

/**
 * One loop's state word. A stalled lane wins over everything (it is also an attention item), then a waiting release.
 * Paused comes before Likely running: the pause commit itself is recent activity, and a paused loop runs nothing.
 */
export function loopStripState(loop: Summary, now: Date): StripState {
  if (loop.lanes?.some((l) => l.state === 'stalled')) return 'stalled';
  if (releaseWaiting(loop)) return 'release-waiting';
  if (loop.paused) return 'paused';
  if (loop.state === 'done') return loop.shipped ? 'released' : 'done';
  if (loop.runOutcomes?.running.length) return 'running';
  if (now.getTime() - lastActivity(loop) < RUN_WINDOW_MS) return 'likely-running';
  return allLanesSleeping(loop) ? 'sleeping' : 'idle';
}

/** Every lane that still has work is held back by the schedule (sleeping or snoozed). */
export function allLanesSleeping(loop: Pick<LoopSummary, 'lanes' | 'runOutcomes'>): boolean {
  const open = (loop.lanes ?? []).filter((l) => l.state !== 'done');
  const sleeping = new Set(loop.runOutcomes?.sleeping ?? []);
  return open.length > 0 && open.every((l) => sleeping.has(l.name));
}

/**
 * Usage-limit stops in the last 5 h over the laned loops (only they have runs). Undefined ("not checked") unless every laned
 * loop reports run outcomes and none has gone silent ("Routines look off" zeroes the count), so none and unknown never look alike.
 */
export function limitStopsOf(loops: Pick<LoopSummary, 'lanes' | 'runOutcomes'>[]): number | undefined {
  const laned = loops.filter((l) => l.lanes !== undefined);
  if (laned.length === 0 || laned.some((l) => !l.runOutcomes || l.runOutcomes.routinesLookOff)) return undefined;
  return laned.reduce((n, l) => n + (l.runOutcomes?.limitStops5h ?? 0), 0);
}

const STATE_TONE: Record<StripState, Tone> = {
  stalled: 'blocked', 'release-waiting': 'blocked', running: 'building', 'likely-running': 'building', sleeping: 'muted', paused: 'muted', idle: 'muted', released: 'done', done: 'done',
};

function stateSegment(loops: Summary[], now: Date, scoped: boolean): Segment {
  const states = loops.map((l) => loopStripState(l, now));
  const top = STRIP_STATES.find((s) => states.includes(s)) ?? 'idle';
  const which = loops.filter((_, i) => states[i] === top);
  const first = which[0];
  // On the fleet, say which loop (or how many) the word is about.
  const who = scoped || loops.length < 2 ? '' : which.length === 1 && first ? ` · ${first.name}` : ` · ${which.length} of ${loops.length} loops`;
  const lanes = scoped && top === 'running' && first?.runOutcomes ? ` · ${first.runOutcomes.running.join(', ')}` : '';
  return { id: 'state', text: `${STRIP_STATE_LABEL[top]}${who}${lanes}`, short: STRIP_STATE_LABEL[top], tone: STATE_TONE[top], icon: top, ...(!scoped && which.length === 1 && first && loops.length > 1 ? { href: loopHref(first.id) } : {}) };
}

function needsSegment(count: number): Segment {
  return count > 0
    ? { id: 'needs', text: `${count} need${count === 1 ? 's' : ''} you`, tone: 'blocked', icon: 'inbox', href: '#/inbox' }
    : { id: 'needs', text: 'Nothing needs you', tone: 'done', icon: 'check' };
}

/** "3 of 7 done-whens", from the contract (per lane for laned loops); undefined without one. */
export function doneWhenProgress(detail: Detail | undefined): string | undefined {
  const items = detail?.laneNotes?.length ? detail.laneNotes.flatMap((n) => n.contract) : detail?.contract ?? [];
  if (items.length === 0) return undefined;
  return `${items.filter((c) => c.pass).length} of ${items.length} done-whens`;
}

function roundSegment(loops: Summary[], detail: Detail | undefined, scoped: boolean): Segment | undefined {
  const loop = loops[0];
  if (scoped && loop) {
    const round = loop.roundLabel ?? (loop.roundsTotal > 0 ? `Round ${loop.round} of ${loop.roundsTotal}` : undefined);
    const progress = doneWhenProgress(detail);
    const text = [round, progress].filter(Boolean).join(' · ');
    // The phone strip leaves it to the loop header (which shows the round), so line 2 stays one line at 375 px.
    return text ? { id: 'round', text, short: '', tone: 'text', icon: 'round' } : undefined;
  }
  const done = loops.filter((l) => l.state === 'done').length;
  // The phone strip leaves the fleet's round count to the cards below it.
  return { id: 'round', text: `${loops.length} loop${loops.length === 1 ? '' : 's'} · ${done} done`, short: '', tone: 'text', icon: 'round' };
}

/** CI on main where the loop reports it, else its newest test result; undefined when neither was measured. */
export function checksOk(loop: Pick<LoopSummary, 'ci' | 'tests'>): boolean | undefined {
  if (loop.ci) return loop.ci.ok;
  if (loop.tests) return loop.tests.failed === 0;
  return undefined;
}

function ciSegment(loops: Summary[], scoped: boolean): Segment {
  const known = loops.map((l) => ({ l, ok: checksOk(l) })).filter((x) => x.ok !== undefined);
  const failing = known.filter((x) => !x.ok);
  if (known.length === 0) return { id: 'ci', text: 'CI not checked', tone: 'muted', icon: 'dash' };
  if (failing.length > 0) {
    const who = scoped ? '' : failing.length === 1 && failing[0] ? ` · ${failing[0].l.name}` : ` · ${failing.length} loops`;
    return { id: 'ci', text: `CI failing${who}`, short: 'CI failing', tone: 'failing', icon: 'cross', href: scoped ? '#/health' : loopHref(failing[0]?.l.id ?? '') };
  }
  const unknown = loops.length - known.length;
  const partial = !scoped && unknown > 0 ? ` on ${known.length} · ${unknown} not checked` : '';
  return { id: 'ci', text: `CI passing${partial}`, ...(partial && { short: `CI passing ${known.length}/${loops.length}` }), tone: 'done', icon: 'check' };
}

function limitSegment(limitStops: number | undefined, href: string | undefined): Segment {
  // "None" and "unknown" must never look alike.
  if (limitStops === undefined) return { id: 'limits', text: 'Limit stops not checked', short: 'Limits not checked', tone: 'muted', icon: 'dash' };
  if (limitStops === 0) return { id: 'limits', text: 'No limit stops', tone: 'muted', icon: 'check' };
  return { id: 'limits', text: `${limitStops} limit stop${limitStops === 1 ? '' : 's'} in 5 h`, short: `${limitStops} limit stop${limitStops === 1 ? '' : 's'}`, tone: 'blocked', icon: 'warn', ...(href ? { href } : {}) };
}

function shipSegment(loops: Summary[], details: ReadonlyMap<string, Detail>): Segment | undefined {
  const waiting = loops.find((l) => releaseWaiting(l));
  if (waiting) {
    const ship = details.get(waiting.id)?.ship;
    if (!ship) return undefined;
    const first = ship.items.find((i) => !i.ok);
    return ship.ready
      ? { id: 'ship', text: 'Ready to ship', tone: 'done', icon: 'check', href: loopHref(waiting.id) }
      : { id: 'ship', text: `Not ready${first ? ` · failing check: ${first.label}` : ''}`, short: 'Not ready', tone: 'blocked', icon: 'warn', href: loopHref(waiting.id) };
  }
  const shipped = loops.filter((l) => l.shipped);
  const one = shipped.length === 1 ? shipped[0] : undefined;
  // Nothing to ship while the round is still building: that is not a question, so the segment is left out.
  if (!one?.shipped) return undefined;
  const who = loops.length > 1 ? ` · ${one.name}` : '';
  return { id: 'ship', text: `${releasedText(one.shipped)}${who}`, short: `${one.shipped.version} released`, tone: 'done', icon: 'tag' };
}

/** "02:15 UTC" today, "14 Oct 02:15 UTC" on another day. */
export function dueTime(iso: string, now: Date): string {
  return iso.slice(0, 10) === now.toISOString().slice(0, 10) ? `${iso.slice(11, 16)} UTC` : activityStamp(iso);
}

function nextSegment(loops: Summary[], details: ReadonlyMap<string, Detail>, now: Date): Segment | undefined {
  const lanes = loops.flatMap((l) => details.get(l.id)?.nextRuns ?? []).filter((r) => !Number.isNaN(new Date(r.at).getTime()));
  const lane = [...lanes].sort((a, b) => a.at.localeCompare(b.at))[0];
  if (lane) return { id: 'next', text: `next: ${lane.lane} ${dueTime(lane.at, now)}`, tone: 'text', icon: 'clock' };
  const due = loops.map((l) => l.runOutcomes?.nextDue).filter((d): d is { lane: string; at: string } => !!d && !Number.isNaN(new Date(d.at).getTime()));
  const soonest = [...due].sort((a, b) => a.at.localeCompare(b.at))[0];
  // Phone: left out (short ''), so line 2 stays one line; the state segment already says Running or Sleeping.
  if (soonest) return { id: 'next', text: `next: ${soonest.lane} ${dueTime(soonest.at, now)}`, short: '', tone: 'text', icon: 'clock' };
  if (loops.some((l) => l.state !== 'done' && allLanesSleeping(l))) return { id: 'next', text: 'all lanes sleeping', short: '', tone: 'muted', icon: 'sleeping' };
  const at = loops.map((l) => l.nextRunAt).filter((t): t is string => !!t && !Number.isNaN(new Date(t).getTime())).sort()[0];
  if (at) return { id: 'next', text: `next run ${dueTime(at, now)}`, tone: 'text', icon: 'clock' };
  return undefined;
}

export interface StripInput {
  /** Every loop on the fleet, or just the one loop on its page. */
  loops: Summary[];
  /** True on a loop page: segments describe that loop only. */
  scoped: boolean;
  /** The one attention list's length (`attentionItems`), so the strip, banner, badge and Inbox agree. */
  attention: number;
  /** Loop details already loaded, by id: ship check, next runs, contract. */
  details?: ReadonlyMap<string, Detail>;
  /** Usage-limit stops in the last 5 h; undefined until run outcomes are in the data. */
  limitStops?: number;
  now: Date;
}

/** The status strip's segments in their fixed order (DESIGN.md §12 C1). Segments without data are left out, except CI and limit stops, which say "not checked". */
export function stripSegments(input: StripInput): Segment[] {
  const { loops, scoped, now } = input;
  const details = input.details ?? new Map<string, Detail>();
  const only = scoped ? loops[0] : undefined;
  const segments: (Segment | undefined)[] = [
    stateSegment(loops, now, scoped),
    needsSegment(input.attention),
    roundSegment(loops, only ? details.get(only.id) : undefined, scoped),
    ciSegment(loops, scoped),
    limitSegment(input.limitStops ?? limitStopsOf(loops), only ? `${loopHref(only.id)}` : undefined),
    shipSegment(loops, details),
    nextSegment(loops, details, now),
  ];
  return segments.filter((s): s is Segment => s !== undefined);
}
