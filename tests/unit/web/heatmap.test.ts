import { describe, expect, it } from 'vitest';
import type { LoopRun } from '../../../src/core/types.js';
import { HEAT_LABEL, HEAT_ORDER, heatCellHref, heatCellLabel, heatGrid, heatOutcome } from '../../../web/src/lib/heatmap.js';
import { parseRoute } from '../../../web/src/lib/route.js';

const run = (lane: string, at: string, outcome: LoopRun['outcome'] = 'pushed', extra: Partial<LoopRun> = {}): LoopRun => ({ lane, at, outcome, units: [], commits: [], ...extra });

describe('heatOutcome', () => {
  it('maps every core slot kind to a heat-map word', () => {
    const kinds: NonNullable<LoopRun['kind']>[] = ['worked', 'idle', 'tests-failed', 'not-due', 'running', 'missed', 'paused', 'done'];
    expect(kinds.map((kind) => heatOutcome({ kind, outcome: 'no-run-recorded' }))).toEqual(['worked', 'idle', 'failed', 'not-due', 'running', 'limit-stop', 'paused', 'done']);
  });
  it('falls back to the run outcome when the server sent no kind', () => {
    expect((['pushed', 'nothing-pushed', 'tests-failed', 'no-run-recorded'] as const).map((outcome) => heatOutcome({ outcome }))).toEqual(['worked', 'idle', 'failed', 'limit-stop']);
  });
  it('calls a run that finished units worked even when it pushed nothing', () => {
    expect(heatOutcome({ outcome: 'nothing-pushed', units: ['a'] })).toBe('worked');
    expect(heatOutcome({ outcome: 'nothing-pushed', units: [] })).toBe('idle');
  });
  it('has a legend word for every outcome', () => {
    expect(new Set(HEAT_ORDER)).toEqual(new Set(Object.keys(HEAT_LABEL)));
  });
});

describe('heatGrid', () => {
  const now = new Date('2026-10-13T10:40:00Z');
  it('has one column per hour up to now, oldest first', () => {
    const g = heatGrid([run('web', '2026-10-13T10:05:00Z')], now);
    expect(g.hours).toHaveLength(24);
    expect(g.hours[0]).toBe('2026-10-12T11:00:00.000Z');
    expect(g.hours[23]).toBe('2026-10-13T10:00:00.000Z');
    expect(g.rows[0]?.cells[23]?.outcome).toBe('worked');
  });
  it('leaves hours without a slot empty, drops slots outside the window and lanes with no cell', () => {
    const g = heatGrid([run('web', '2026-10-13T08:10:00Z'), run('web', '2026-10-12T09:00:00Z'), run('core', '2026-10-13T12:00:00Z')], now, 24, ['core', 'web', 'docs']);
    expect(g.rows.map((r) => r.lane)).toEqual(['web']);
    expect(g.rows[0]?.cells.filter(Boolean)).toHaveLength(1);
    expect(g.rows[0]?.cells[21]?.run.at).toBe('2026-10-13T08:10:00Z');
  });
  it('orders lanes by the given list, then others, and keeps the newest slot of an hour', () => {
    const g = heatGrid([run('zeta', '2026-10-13T09:00:00Z'), run('web', '2026-10-13T09:05:00Z', 'nothing-pushed'), run('web', '2026-10-13T09:40:00Z'), run('core', '2026-10-13T09:00:00Z')], now, 24, ['core', 'web']);
    expect(g.rows.map((r) => r.lane)).toEqual(['core', 'web', 'zeta']);
    expect(g.rows[1]?.cells[22]?.run.at).toBe('2026-10-13T09:40:00Z');
  });
  it('prefers a recorded run over a missed slot at the same moment', () => {
    const at = '2026-10-13T09:05:00Z';
    for (const order of [[run('web', at, 'no-run-recorded'), run('web', at)], [run('web', at), run('web', at, 'no-run-recorded')]]) {
      expect(heatGrid(order, now).rows[0]?.cells[22]?.outcome).toBe('worked');
    }
  });
  it('folds to fewer hours when asked', () => {
    expect(heatGrid([], now, 12).hours).toHaveLength(12);
  });
});

describe('heatCellLabel and heatCellHref', () => {
  it('says lane, time and outcome with the useful detail', () => {
    expect(heatCellLabel({ run: run('web', '2026-10-13T14:00:00Z', 'pushed', { units: ['a', 'b'] }), outcome: 'worked' })).toBe('web 14:00 UTC: worked, 2 units');
    expect(heatCellLabel({ run: run('core', '2026-10-13T09:00:00Z', 'tests-failed', { tests: { passed: 3, failed: 2 } }), outcome: 'failed' })).toBe('core 09:00 UTC: failed, 2 failing');
    expect(heatCellLabel({ run: run('kit', '2026-10-13T09:00:00Z', 'no-run-recorded'), outcome: 'limit-stop' })).toBe('kit 09:00 UTC: limit stop, no run logged (usage limit or a failed start)');
    expect(heatCellLabel({ run: run('docs', '2026-10-13T09:00:00Z', 'no-run-recorded', { kind: 'not-due' }), outcome: 'not-due' })).toBe('docs 09:00 UTC: not due');
  });
  it('links to the slot in the Runs tab, and the route reads it back', () => {
    const link = heatCellHref('my loop', { lane: 'web', at: '2026-10-13T14:00:00Z' });
    expect(link).toBe('#/loop/my%20loop?tab=Runs&run=2026-10-13T14%3A00%3A00Z&lane=web');
    expect(parseRoute(link)).toEqual({ name: 'loop', id: 'my loop', focus: { lane: 'web', at: '2026-10-13T14:00:00Z' } });
  });
});

describe('parseRoute', () => {
  it('ignores an incomplete or foreign query', () => {
    expect(parseRoute('#/loop/self')).toEqual({ name: 'loop', id: 'self' });
    expect(parseRoute('#/loop/self?tab=Runs&run=x')).toEqual({ name: 'loop', id: 'self' });
    expect(parseRoute('#/loop/self?tab=Tests&run=x&lane=web')).toEqual({ name: 'loop', id: 'self' });
    expect(parseRoute('#/inbox?x=1')).toEqual({ name: 'inbox' });
  });
});
