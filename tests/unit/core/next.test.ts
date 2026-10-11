import { describe, expect, it } from 'vitest';
import { formatNext, planNext } from '../../../src/core/next.js';
import { doneUnits, openUnits } from '../../../src/core/parse/task.js';

const task = (status: string, handoff = 'Nothing yet.') => `Run: 1 / 20\nStatus: ${status}\n\n## Units, in order\n1. A\n2. B\n3. C\n4. D\n5. E\n\n## Handoff\n${handoff}\n`;
const now = new Date('2026-10-11T10:00:00Z');
const future = 'Sam · expires 2026-10-11T11:00:00.000Z';
const past = 'Sam · expires 2026-10-11T09:00:00.000Z';

describe('doneUnits', () => {
  it('reads ranges, lists and both phrasings', () => {
    expect([...doneUnits(task('in progress (units 1-2 done)'))]).toEqual([1, 2]);
    expect([...doneUnits(task('x', 'Run 2 shipped units 1, 3 and 4.'))].sort()).toEqual([1, 3, 4]);
    expect([...doneUnits(task('x', 'Run 1 shipped unit 2.'))]).toEqual([2]);
  });
  it('reads "Done:" with a colon and repeated "unit N" mentions', () => {
    expect([...doneUnits(task('x', 'Done: unit 1 (audit), unit 5 (docs).\nNext: unit 2.'))].sort()).toEqual([1, 5]);
    expect([...doneUnits(task('x', 'Done: 1, 2, 3'))].sort()).toEqual([1, 2, 3]);
  });
  it('ignores partial units and the Next: line', () => {
    expect([...doneUnits(task('units 1-4 done, unit 5 partly'))]).toEqual([1, 2, 3, 4]);
    expect(doneUnits(task('x', 'Next: finish units 2-3 done properly')).size).toBe(0);
  });
  it('uses the newest Handoff', () => {
    expect([...doneUnits(`${task('x', 'shipped unit 1')}\n## Handoff (run 2)\nshipped units 1-3\n`)]).toEqual([1, 2, 3]);
  });
  it('openUnits drops the done ones', () => {
    expect(openUnits(task('units 1-3 done')).map((u) => u.number)).toEqual([4, 5]);
  });
});

describe('planNext', () => {
  it('recommends the first unclaimed lane with an open unit', () => {
    const r = planNext([
      { name: 'a', state: 'waiting', taskText: task('units 1-5 done'), claimText: undefined },
      { name: 'b', state: 'waiting', taskText: task('units 1 done'), claimText: future },
      { name: 'c', state: 'waiting', taskText: task('units 1-2 done'), claimText: past },
    ], now);
    expect(r.recommended).toEqual({ lane: 'c', unit: { number: 3, text: 'C' } });
    expect(r.lanes[1]?.claim).toEqual({ name: 'Sam', expiresAt: '2026-10-11T11:00:00.000Z' });
    expect(r.lanes[2]?.claim).toBeUndefined();
  });
  it('skips done and blocked lanes and recommends nothing when all are taken', () => {
    const r = planNext([
      { name: 'a', state: 'done', taskText: task('x') },
      { name: 'b', state: 'blocked', taskText: task('x') },
      { name: 'c', state: 'waiting', taskText: task('x'), claimText: future },
      { name: 'd', state: 'waiting' },
    ], now);
    expect(r.recommended).toBeUndefined();
    expect(r.lanes[0]?.openUnits).toEqual([]);
    expect(formatNext(r)).toContain('Nothing to recommend');
  });
  it('--json shape is stable', () => {
    const r = planNext([{ name: 'a', state: 'waiting', taskText: task('x') }], now);
    expect(Object.keys(r).sort()).toEqual(['lanes', 'recommended']);
    expect(Object.keys(r.lanes[0] ?? {}).sort()).toEqual(['name', 'openUnits', 'state']);
    expect(formatNext(r)).toContain('Recommended: a, unit 1. Take it with `loop claim a`');
  });
});
