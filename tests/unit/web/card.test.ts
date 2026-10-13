import { describe, expect, it } from 'vitest';
import { activityStamp, cardBadge, headerRound, releasedText, cardFacts, statusLine, laneProgress, roundProgress, runBudget, selfFirst } from '../../../web/src/lib/card.js';

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
});
