import { describe, expect, it } from 'vitest';
import { activityStamp, cardFacts, roundProgress, runBudget, selfFirst } from '../../../web/src/lib/card.js';

describe('fleet card model', () => {
  it('puts the self-build loop first and keeps the rest in order', () => {
    expect(selfFirst([{ id: 'a' }, { id: 'compounding-loop' }, { id: 'b' }]).map((l) => l.id)).toEqual(['compounding-loop', 'a', 'b']);
    expect(selfFirst([{ id: 'a' }]).map((l) => l.id)).toEqual(['a']);
  });
  it('tells the round story and clamps', () => {
    expect(roundProgress({ round: 2, roundsTotal: 2, state: 'done' }).text).toBe('Round 2 of 2 done');
    expect(roundProgress({ round: 1, roundsTotal: 3, state: 'building' })).toEqual({ value: 1, max: 3, text: 'Round 1 of 3' });
    expect(roundProgress({ round: 9, roundsTotal: 2, state: 'building' }).value).toBe(2);
  });
  it('shows the run budget as text and a bar value', () => {
    expect(runBudget({ run: 15, runLimit: 150 })).toEqual({ value: 15, max: 150, text: '15 of 150 runs' });
    expect(runBudget({ run: 0, runLimit: 0 }).max).toBe(1);
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
});
