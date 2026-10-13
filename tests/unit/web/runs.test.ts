import { describe, expect, it } from 'vitest';
import type { LoopRun } from '../../../src/core/types.js';
import { filterRuns, groupRunsByDay, lastFailure, silentLanes, testSeries, testsText, testStamp } from '../../../web/src/lib/runs.js';

const run = (lane: string, at: string, outcome: LoopRun['outcome'] = 'pushed'): LoopRun => ({ lane, at, outcome, units: [], commits: [] });

describe('runs helpers', () => {
  const runs = [
    run('web', '2026-10-11T21:00:00Z'), run('core', '2026-10-11T20:00:00Z', 'nothing-pushed'), run('web', '2026-10-10T21:00:00Z'),
  ];
  it('filters by lane and keeps all when none is selected', () => {
    expect(filterRuns(runs, new Set())).toHaveLength(3);
    expect(filterRuns(runs, new Set(['web'])).map((r) => r.lane)).toEqual(['web', 'web']);
  });
  it('groups by UTC day, newest first', () => {
    expect(groupRunsByDay(runs).map((g) => [g.day, g.runs.length])).toEqual([['2026-10-11', 2], ['2026-10-10', 1]]);
    expect(groupRunsByDay([])).toEqual([]);
  });
  it('flags a lane only after three missed slots in a row', () => {
    const missed = (lane: string, h: number) => run(lane, `2026-10-11T${String(h).padStart(2, '0')}:00:00Z`, 'no-run-recorded');
    expect(silentLanes([missed('web', 9), missed('web', 8), run('web', '2026-10-11T07:00:00Z')])).toEqual([]);
    expect(silentLanes([missed('web', 9), missed('core', 9), missed('web', 8), missed('web', 7)])).toEqual(['web']);
    expect(silentLanes([missed('web', 9), run('web', '2026-10-11T08:00:00Z'), missed('web', 7), missed('web', 6)])).toEqual([]);
  });
  it('words the test result', () => {
    expect(testsText(undefined)).toBeUndefined();
    expect(testsText({ passed: 12, failed: 0 })).toBe('12 passed');
    expect(testsText({ passed: 12, failed: 2 })).toBe('2 failed, 12 passed');
  });
});

describe('test history', () => {
  const withTests = (at: string, passed: number, failed: number): LoopRun => ({ ...run('web', at), tests: { passed, failed } });
  const runs = [withTests('2026-10-11T21:00:00Z', 50, 0), run('core', '2026-10-11T20:30:00Z'), withTests('2026-10-11T20:00:00Z', 48, 2), withTests('2026-10-10T20:00:00Z', 40, 0)];
  it('keeps only runs with tests, oldest first', () => {
    expect(testSeries(runs).map((p) => p.passed)).toEqual([40, 48, 50]);
    expect(testSeries([])).toEqual([]);
  });
  it('finds the newest failing run or nothing', () => {
    expect(lastFailure(testSeries(runs))).toEqual({ at: '2026-10-11T20:00:00Z', lane: 'web', passed: 48, failed: 2 });
    expect(lastFailure([{ at: 'x', passed: 1, failed: 0 }])).toBeUndefined();
  });
});

describe('testStamp (round 5 A4)', () => {
  it('says UTC once', () => {
    expect(testStamp('2026-10-11T14:53:00Z')).toBe('Sun 11 Oct 14:53 UTC');
  });
});
