import { describe, expect, it } from 'vitest';
import { deriveStatus } from '../../../src/core/status.js';
import type { LoopFacts } from '../../../src/core/types.js';

const now = new Date('2026-10-08T12:00:00Z');
const base: LoopFacts = { hasBlocked: false, hasDone: false, roundsDone: 0, healthFailures: [] };
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

describe('deriveStatus', () => {
  it('lets a failing health check override every other state', () => {
    expect(deriveStatus({ ...base, hasBlocked: true, healthFailures: ['CLAUDE.md is public'] }, now))
      .toEqual({ state: 'failing', reason: 'CLAUDE.md is public' });
  });
  it('puts blocked before done', () => {
    expect(deriveStatus({ ...base, hasBlocked: true, hasDone: true }, now).state).toBe('blocked');
  });
  it('reports done with the round number', () => {
    expect(deriveStatus({ ...base, hasDone: true, roundsDone: 2 }, now)).toEqual({ state: 'done', reason: 'Round 3 finished' });
  });
  it('treats a lock under 90 minutes as building, and an older one as stale', () => {
    expect(deriveStatus({ ...base, lockAt: minutesAgo(89) }, now).state).toBe('building');
    expect(deriveStatus({ ...base, lockAt: minutesAgo(91) }, now).state).toBe('waiting');
  });
  it('treats a commit in the last hour as building', () => {
    expect(deriveStatus({ ...base, lastCommitAt: minutesAgo(59) }, now).state).toBe('building');
    expect(deriveStatus({ ...base, lastCommitAt: minutesAgo(61) }, now).state).toBe('waiting');
  });
});
