import { describe, expect, it } from 'vitest';
import { activityStamp, badgeFilters, cardBadge, chipHold, headerReason, stateReason, headerRound, releasedText, cardFacts, statusLine, laneProgress, roundProgress, runBudget, selfFirst } from '../../../web/src/lib/card.js';

describe('fleet card model', () => {
  it('puts the self-build loop first and keeps the rest in order', () => {
    expect(selfFirst([{ id: 'a' }, { id: 'compounding-loop' }, { id: 'b' }]).map((l) => l.id)).toEqual(['compounding-loop', 'a', 'b']);
    expect(selfFirst([{ id: 'a' }]).map((l) => l.id)).toEqual(['a']);
  });
  it('tells the round story and clamps', () => {
    expect(roundProgress({ round: 2, roundsTotal: 2, state: 'done' })?.text).toBe('Round 2 of 2 done');
    expect(roundProgress({ round: 1, roundsTotal: 3, state: 'building' })).toEqual({ value: 1, max: 3, text: 'Round 1 of 3' });
    expect(roundProgress({ round: 9, roundsTotal: 2, state: 'building' })).toEqual({ value: 2, max: 2, text: 'Round 9 of 2' });
    expect(roundProgress({ round: 1, roundsTotal: 0, state: 'building' })).toBeUndefined();
    expect(roundProgress({ round: NaN, roundsTotal: 2, state: 'building' })?.text).toBe('Round 0 of 2');
  });
  it('a finished laned round says the release waits (round 4 A2, A7)', () => {
    expect(roundProgress({ round: 3, roundsTotal: 3, state: 'done', lanes: [{}] })?.text).toBe('Round 3 done · release waiting on you');
  });
  it('labels bundled data as a snapshot with its date (A6)', () => {
    expect(cardFacts({ snapshotAt: '2026-10-06T10:00:00Z' })).toContainEqual({ label: 'Data', value: 'snapshot 6 Oct' });
    expect(cardFacts({})).toEqual([]);
  });
  it('shows the run budget as text and a bar value', () => {
    expect(runBudget({ run: 15, runLimit: 150 })).toEqual({ value: 15, max: 150, text: '15 of 150 runs' });
    expect(runBudget({ run: 0, runLimit: 0 })).toBeUndefined();
    expect(runBudget({ run: 40, runLimit: 30 })).toEqual({ value: 30, max: 30, text: '40 of 30 runs' });
  });
  it('formats activity in absolute UTC', () => {
    expect(activityStamp('2026-10-11T14:05:00Z')).toBe('11 Oct 14:05 UTC');
  });
  it('omits facts that have no data', () => {
    expect(cardFacts({})).toEqual([]);
    expect(cardFacts({ tests: { passed: 5, failed: 1 } as never, live: { ok: true, status: 200 } as never, lastCommit: { at: '2026-10-11T14:05:00Z' } as never }))
      .toEqual([
        { label: 'Last activity', value: '11 Oct 14:05 UTC' },
        { label: 'Tests', value: '5 passed, 1 failed' },
        { label: 'Live site', value: 'up (200)' },
      ]);
  });
  it('shows lane progress for a building laned loop only', () => {
    const lanes = [{ state: 'done' }, { state: 'working' }, { state: 'done' }] as never;
    expect(laneProgress({ lanes, state: 'building' })).toEqual({ value: 2, max: 3, text: '2 of 3 lanes done' });
    expect(laneProgress({ lanes, state: 'done' })).toBeUndefined();
    expect(laneProgress({ state: 'building' })).toBeUndefined();
  });
  it('hides the run budget when finished or not started', () => {
    expect(runBudget({ run: 0, runLimit: 30, state: 'done' })).toBeUndefined();
    expect(runBudget({ run: 5, runLimit: 30, state: 'done' })).toBeUndefined();
    expect(runBudget({ run: 5, runLimit: 30, state: 'building' })?.text).toBe('5 of 30 runs');
  });
  it('adds CI and demo rows for the live self-build card', () => {
    expect(cardFacts({ ci: { ok: true, reason: '' }, demoUrl: 'https://minntooos.github.io/Compounding-Loop/' }))
      .toEqual([{ label: 'CI', value: 'passing on main' }, { label: 'Live site', value: 'minntooos.github.io/Compounding-Loop/' }]);
  });
  it('puts the pause or the newest run into the one status line (round 4 C)', () => {
    expect(statusLine({ reason: 'lane web is building' })).toBe('lane web is building');
    expect(statusLine({ reason: 'x', lastRun: { lane: 'web', at: '2026-10-11T21:44:00Z', outcome: 'pushed' } })).toBe('x · last run 21:44 UTC: pushed');
    expect(statusLine({ reason: 'x', paused: { by: 'Mina', at: '2026-10-11T14:05:00Z', reason: 'budget' } })).toBe('Paused by Mina since 14:05 UTC · budget');
    expect(statusLine({ reason: 'x', paused: { by: 'Mina' } })).toBe('Paused by Mina');
  });
});

describe('round 5 A1/A8 card text', () => {
  it('a shipped laned round says "0.4.0 released 13 Oct" instead of "release waiting on you"', () => {
    const lanes = [{}];
    const shipped = { version: '0.4.0', date: '2026-10-13T00:40:00Z', npm: 'latest' as const };
    expect(roundProgress({ round: 4, roundsTotal: 4, state: 'done', lanes, shipped })?.text).toBe('Round 4 done · 0.4.0 released 13 Oct');
    expect(roundProgress({ round: 4, roundsTotal: 4, state: 'done', lanes })?.text).toBe('Round 4 done · release waiting on you');
    expect(releasedText({ version: '1.0.0', npm: 'unknown' })).toBe('1.0.0 released');
  });
  it('the loop header names the round once', () => {
    expect(headerRound({ round: 5, roundsTotal: 5, reason: 'Round 5: building', roundLabel: 'Round 5' })).toBeUndefined();
    expect(headerRound({ round: 5, roundsTotal: 5, reason: 'Building', roundLabel: 'Round 5' })).toBe('Round 5');
    expect(headerRound({ round: 2, roundsTotal: 3, reason: 'Building' })).toBe('Round 2/3');
    expect(headerRound({ round: 0, roundsTotal: 0, reason: 'x' })).toBeUndefined();
  });
});

describe('cardBadge', () => {
  const off = { limitStops5h: 3, running: [], sleeping: [], routinesLookOff: true };
  const lane = (state: 'building' | 'stalled') => ({ name: 'web', state, run: 1, limit: 20, locked: false, unanswered: [] });
  it('a building or waiting loop reads Stalled when its routines look off or a lane stalled, like the strip', () => {
    expect(cardBadge({ state: 'building', runOutcomes: off })).toBe('stalled');
    expect(cardBadge({ state: 'waiting', lanes: [lane('building'), lane('stalled')] })).toBe('stalled');
    expect(cardBadge({ state: 'building', runOutcomes: { ...off, routinesLookOff: false }, lanes: [lane('building')] })).toBe('building');
  });
  it('failing, blocked and done keep their own badge', () => {
    expect(cardBadge({ state: 'failing', runOutcomes: off })).toBe('failing');
    expect(cardBadge({ state: 'blocked', runOutcomes: off })).toBe('blocked');
    expect(cardBadge({ state: 'done', runOutcomes: off })).toBe('done');
  });
  it('a paused building or waiting loop reads Paused, below Stalled like the strip', () => {
    expect(cardBadge({ state: 'building', paused: { by: 'owner' } })).toBe('paused');
    expect(cardBadge({ state: 'waiting', paused: { by: 'owner' }, lanes: [lane('building')] })).toBe('paused');
    expect(cardBadge({ state: 'building', paused: { by: 'owner' }, runOutcomes: off })).toBe('stalled');
    expect(cardBadge({ state: 'building', paused: { by: 'owner' }, lanes: [lane('stalled')] })).toBe('paused');
    expect(cardBadge({ state: 'failing', paused: { by: 'owner' } })).toBe('failing');
  });
});

describe('stateReason and chipHold', () => {
  const off = { limitStops5h: 0, running: [], sleeping: ['docs'], routinesLookOff: true };
  it('a building loop whose routines look off says so instead of its reason, also in the status line', () => {
    expect(stateReason({ reason: 'Building', state: 'building', runOutcomes: off })).toBe('Routines look off');
    expect(stateReason({ reason: 'Tests failing', state: 'failing', runOutcomes: off })).toBe('Tests failing');
    expect(statusLine({ reason: 'Building', state: 'building', runOutcomes: off, lastRun: { lane: 'web', at: '2026-10-11T21:44:00Z', outcome: 'pushed' } })).toBe('Routines look off · last run 21:44 UTC: pushed');
  });
  it('a card chip shows a sleeping lane or the whole loop paused, never for a done lane', () => {
    expect(chipHold({ runOutcomes: off }, { name: 'docs', state: 'waiting' })).toBe('sleeping');
    expect(chipHold({ runOutcomes: off }, { name: 'web', state: 'building' })).toBeUndefined();
    expect(chipHold({ paused: { by: 'sam' } }, { name: 'web', state: 'building' })).toBe('loop-paused');
    expect(chipHold({ paused: { by: 'sam' } }, { name: 'kit', state: 'done' })).toBeUndefined();
  });
});

describe('badgeFilters', () => {
  it('counts loops by the badge their card shows, so a paused or stalled loop is not counted as Building', () => {
    const off = { limitStops5h: 0, running: [], sleeping: [], routinesLookOff: true };
    const loops = [
      { state: 'building' as const }, { state: 'building' as const, paused: { by: 'owner' } },
      { state: 'waiting' as const, runOutcomes: off }, { state: 'done' as const }, { state: 'done' as const },
    ];
    expect(badgeFilters(loops)).toEqual([
      { badge: 'stalled', count: 1 }, { badge: 'building', count: 1 }, { badge: 'paused', count: 1 }, { badge: 'done', count: 2 },
    ]);
  });
  it('offers no filter when every card shows the same badge', () => {
    expect(badgeFilters([{ state: 'done' }, { state: 'done' }])).toEqual([]);
    expect(badgeFilters([])).toEqual([]);
  });
});

describe('headerReason', () => {
  it('is empty beside a Paused badge: the build reason would contradict it and the paused notice explains', () => {
    expect(headerReason({ state: 'building', reason: 'Building round 5', paused: { by: 'sam', reason: 'holiday' } })).toBeUndefined();
    expect(headerReason({ state: 'waiting', reason: 'Waiting', paused: { by: 'owner' } })).toBeUndefined();
  });
  it('keeps a lock reason beside Paused: pausing does not stop the session that is still running', () => {
    expect(headerReason({ state: 'building', reason: 'A session holds the lock', paused: { by: 'sam' } })).toBe('A session holds the lock');
  });
  it('a paused loop whose dropped reason named the round still shows the round', () => {
    const loop = { state: 'building' as const, reason: 'round 5 "Cockpit" is being built', round: 5, roundsTotal: 5, roundLabel: 'Round 5 · building' };
    expect(headerRound(loop)).toBeUndefined();
    expect(headerRound({ ...loop, paused: { by: 'sam' } })).toBe('Round 5 · building');
  });
  it('keeps the state reason when the badge is not Paused', () => {
    const off = { limitStops5h: 0, running: [], sleeping: [], routinesLookOff: true };
    expect(headerReason({ state: 'building', reason: 'Building', paused: { by: 'sam' }, runOutcomes: off })).toBe('Routines look off');
    expect(headerReason({ state: 'failing', reason: 'Tests failing', paused: { by: 'sam' } })).toBe('Tests failing');
    expect(headerReason({ state: 'building', reason: 'Building round 5' })).toBe('Building round 5');
  });
});
