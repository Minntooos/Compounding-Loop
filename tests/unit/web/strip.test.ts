import { describe, expect, it } from 'vitest';
import type { LaneStatus, LoopDetail, LoopSummary } from '../../../src/core/types.js';
import { allLanesSleeping, checksOk, doneWhenProgress, dueTime, limitStopsOf, loopStripState, stripSegments } from '../../../web/src/lib/strip.js';

const NOW = new Date('2026-10-13T03:00:00Z');
const lane = (name: string, state: LaneStatus['state']): LaneStatus => ({ name, state, run: 1, limit: 20, locked: false, unanswered: [] });
const loop = (over: Partial<LoopSummary> = {}): LoopSummary =>
  ({ id: 'a', name: 'a', state: 'building', reason: '', round: 1, roundsTotal: 3, run: 1, runLimit: 20, ...over }) as LoopSummary;
const text = (segs: { id: string; text: string }[], id: string) => segs.find((s) => s.id === id)?.text;

describe('loopStripState', () => {
  it('stalled beats a waiting release, which beats paused', () => {
    const lanes = [lane('core', 'done'), lane('web', 'stalled')];
    expect(loopStripState(loop({ state: 'done', lanes, paused: { by: 'x' } }), NOW)).toBe('stalled');
    expect(loopStripState(loop({ state: 'done', lanes: [lane('core', 'done')], paused: { by: 'x' } }), NOW)).toBe('release-waiting');
  });
  it('a paused loop is Paused even right after its pause commit', () => {
    expect(loopStripState(loop({ paused: { by: 'x' }, lastCommit: { sha: 's', at: '2026-10-13T02:55:00Z', subject: 'pause' } as unknown as LoopSummary['lastCommit'] }), NOW)).toBe('paused');
  });
  it('recent work inside the 50-minute run window is Likely running, older is Idle', () => {
    expect(loopStripState(loop({ lastRun: { lane: 'web', at: '2026-10-13T02:20:00Z', outcome: 'pushed' } }), NOW)).toBe('likely-running');
    expect(loopStripState(loop({ lastRun: { lane: 'web', at: '2026-10-13T01:00:00Z', outcome: 'pushed' } }), NOW)).toBe('idle');
    expect(loopStripState(loop(), NOW)).toBe('idle');
  });
  it('done loops are Released when shipped, Done otherwise', () => {
    expect(loopStripState(loop({ state: 'done' }), NOW)).toBe('done');
    expect(loopStripState(loop({ state: 'done', lanes: [lane('core', 'done')], shipped: { version: '0.4.0', npm: 'latest' } }), NOW)).toBe('released');
  });
});

describe('stripSegments', () => {
  it('keeps the fixed order and names the one loop on the fleet', () => {
    const loops = [loop({ id: 'self', name: 'self', state: 'done', lanes: [lane('core', 'done')] }), loop({ id: 'b', name: 'b', state: 'done' })];
    const segs = stripSegments({ loops, scoped: false, attention: 1, now: NOW });
    expect(segs.map((s) => s.id)).toEqual(['state', 'needs', 'round', 'ci', 'limits']);
    expect(text(segs, 'state')).toBe('Release waiting · self');
    expect(segs[0]?.href).toBe('#/loop/self');
    expect(text(segs, 'needs')).toBe('1 needs you');
    expect(text(segs, 'round')).toBe('2 loops · 2 done');
  });
  it('counts loops when several share the top state', () => {
    const loops = [loop({ id: 'a', name: 'a' }), loop({ id: 'b', name: 'b' })];
    expect(text(stripSegments({ loops, scoped: false, attention: 0, now: NOW }), 'state')).toBe('Idle · 2 of 2 loops');
  });
  it('says "Nothing needs you" and "Limit stops not checked" so none and unknown differ', () => {
    const segs = stripSegments({ loops: [loop()], scoped: true, attention: 0, now: NOW });
    expect(text(segs, 'needs')).toBe('Nothing needs you');
    expect(text(segs, 'limits')).toBe('Limit stops not checked');
    expect(text(stripSegments({ loops: [loop()], scoped: true, attention: 0, limitStops: 0, now: NOW }), 'limits')).toBe('No limit stops');
    expect(text(stripSegments({ loops: [loop()], scoped: true, attention: 0, limitStops: 2, now: NOW }), 'limits')).toBe('2 limit stops in 5 h');
  });
  it('CI: failing names the loop, partial coverage is said, nothing measured is "not checked"', () => {
    const ok = loop({ id: 'a', name: 'a', ci: { ok: true, reason: '' } });
    const bad = loop({ id: 'b', name: 'b', tests: { passed: 3, failed: 1 } as LoopSummary['tests'] });
    expect(text(stripSegments({ loops: [ok, bad], scoped: false, attention: 0, now: NOW }), 'ci')).toBe('CI failing · b');
    expect(text(stripSegments({ loops: [ok, loop({ id: 'c' })], scoped: false, attention: 0, now: NOW }), 'ci')).toBe('CI passing on 1 · 1 not checked');
    expect(text(stripSegments({ loops: [loop()], scoped: true, attention: 0, now: NOW }), 'ci')).toBe('CI not checked');
  });
  it('a loop page shows its round, done-when progress, ship check and next lane', () => {
    const l = loop({ state: 'done', lanes: [lane('core', 'done')], roundLabel: 'Round 5 done · 0.5.0' });
    const ship: NonNullable<LoopDetail['ship']> = { ready: false, items: [{ id: 'tag', label: 'Tag v0.5.0 is free', ok: false, detail: 'exists' }], openFindings: [] } as unknown as NonNullable<LoopDetail['ship']>;
    const details = new Map([['a', { ship, contract: [{ text: 'x', pass: true }, { text: 'y', pass: false }], nextRuns: [{ lane: 'web', at: '2026-10-13T04:15:00Z' }, { lane: 'core', at: '2026-10-14T01:00:00Z' }] }]]);
    const segs = stripSegments({ loops: [l], scoped: true, attention: 1, details, now: NOW });
    expect(text(segs, 'round')).toBe('Round 5 done · 0.5.0 · 1 of 2 done-whens');
    expect(segs.find((s) => s.id === 'round')?.short).toBe('');
    expect(text(segs, 'ship')).toBe('Not ready · failing check: Tag v0.5.0 is free');
    expect(text(segs, 'next')).toBe('next: web 04:15 UTC');
    expect(text(segs, 'state')).toBe('Release waiting');
  });
  it('a shipped loop shows "<version> released <date>"; a building one has no ship segment', () => {
    const shipped = loop({ state: 'done', lanes: [lane('core', 'done')], shipped: { version: '0.4.0', date: '2026-10-13T00:40:00Z', npm: 'latest' } });
    expect(text(stripSegments({ loops: [shipped], scoped: true, attention: 0, now: NOW }), 'ship')).toBe('0.4.0 released 13 Oct');
    expect(text(stripSegments({ loops: [shipped, loop({ id: 'b' })], scoped: false, attention: 0, now: NOW }), 'ship')).toBe('0.4.0 released 13 Oct · a');
    expect(text(stripSegments({ loops: [loop()], scoped: true, attention: 0, now: NOW }), 'ship')).toBeUndefined();
  });
});

describe('helpers', () => {
  it('checksOk prefers CI, falls back to tests, else unknown', () => {
    expect(checksOk({ ci: { ok: false, reason: '' }, tests: { passed: 1, failed: 0 } as LoopSummary['tests'] })).toBe(false);
    expect(checksOk({ tests: { passed: 1, failed: 0 } as LoopSummary['tests'] })).toBe(true);
    expect(checksOk({})).toBeUndefined();
  });
  it('doneWhenProgress reads lane contracts for laned loops', () => {
    expect(doneWhenProgress({ laneNotes: [{ lane: 'web', contract: [{ text: 'a', pass: true }], decisions: [], knowledge: [] }] })).toBe('1 of 1 done-whens');
    expect(doneWhenProgress(undefined)).toBeUndefined();
  });
  it('dueTime adds the date only for another day', () => {
    expect(dueTime('2026-10-13T04:15:00Z', NOW)).toBe('04:15 UTC');
    expect(dueTime('2026-10-14T04:15:00Z', NOW)).toBe('14 Oct 04:15 UTC');
  });
});

describe('run outcomes (server runOutcomes)', () => {
  const ro = (over: Partial<NonNullable<LoopSummary['runOutcomes']>> = {}) => ({ limitStops5h: 0, running: [], sleeping: [], routinesLookOff: false, ...over });
  const lanes = [lane('core', 'building'), lane('kit', 'building'), lane('docs', 'done')];
  it('Running names the lanes on a loop page', () => {
    expect(loopStripState(loop({ lanes, runOutcomes: ro({ running: ['web'] }) }), NOW)).toBe('running');
    expect(text(stripSegments({ loops: [loop({ lanes, runOutcomes: ro({ running: ['web', 'core'] }) })], scoped: true, attention: 0, now: NOW }), 'state')).toBe('Running · web, core');
  });
  it('Sleeping only when every lane with work is held back', () => {
    expect(allLanesSleeping(loop({ lanes, runOutcomes: ro({ sleeping: ['core', 'kit'] }) }))).toBe(true);
    expect(allLanesSleeping(loop({ lanes, runOutcomes: ro({ sleeping: ['kit'] }) }))).toBe(false);
    expect(loopStripState(loop({ lanes, runOutcomes: ro({ sleeping: ['core', 'kit'] }) }), NOW)).toBe('sleeping');
    expect(text(stripSegments({ loops: [loop({ lanes, runOutcomes: ro({ sleeping: ['core', 'kit'] }) })], scoped: true, attention: 0, now: NOW }), 'next')).toBe('all lanes sleeping');
  });
  it('limit stops add up over loops that report them, else stay "not checked"', () => {
    expect(limitStopsOf([loop(), loop()])).toBeUndefined();
    // Loops without lanes have no runs; every laned loop must report.
    expect(limitStopsOf([loop({ lanes, runOutcomes: ro({ limitStops5h: 2 }) }), loop(), loop({ lanes, runOutcomes: ro() })])).toBe(2);
    expect(limitStopsOf([loop({ lanes, runOutcomes: ro() }), loop({ lanes })])).toBeUndefined();
    // Gone silent: the server zeroes the count, which would read as "No limit stops".
    expect(limitStopsOf([loop({ lanes, runOutcomes: ro({ routinesLookOff: true }) })])).toBeUndefined();
    expect(text(stripSegments({ loops: [loop({ lanes, runOutcomes: ro({ limitStops5h: 2 }) })], scoped: true, attention: 0, now: NOW }), 'limits')).toBe('2 limit stops in 5 h');
    expect(text(stripSegments({ loops: [loop({ lanes, runOutcomes: ro() })], scoped: true, attention: 0, now: NOW }), 'limits')).toBe('No limit stops');
  });
  it('next due comes from runOutcomes.nextDue', () => {
    expect(text(stripSegments({ loops: [loop({ runOutcomes: ro({ nextDue: { lane: 'core', at: '2026-10-13T03:05:00Z' } }) })], scoped: true, attention: 0, now: NOW }), 'next')).toBe('next: core 03:05 UTC');
  });
});
