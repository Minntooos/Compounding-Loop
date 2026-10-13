import { describe, expect, it } from 'vitest';
import { settleNotDue } from '../../../src/server/laneSchedule.js';
import { parseSchedule } from '../../../src/core/parse/index.js';
import type { LaneStatus } from '../../../src/core/types.js';

const NOW = new Date('2026-10-13T17:30:00Z');
const lane = (name: string, state: LaneStatus['state']): LaneStatus => ({ name, state, run: 1, limit: 20, locked: false, unanswered: [] });
const schedule = parseSchedule(JSON.stringify({ version: 1, lanes: {
  docs: { notBefore: '2026-10-13T18:00:00Z', sleeping: false, paused: false, reason: null },
  kit: { notBefore: null, sleeping: true, paused: false, reason: null },
  web: { notBefore: '2026-10-13T10:00:00Z', sleeping: false, paused: false, reason: null },
} }));

describe('settleNotDue', () => {
  it('a snoozed or sleeping lane is waiting, not stalled', () => {
    const out = settleNotDue([lane('docs', 'stalled'), lane('kit', 'stalled')], schedule, false, NOW);
    expect(out.map((l) => l.state)).toEqual(['waiting', 'waiting']);
  });
  it('a lane whose snooze has passed, or with no entry, stays stalled', () => {
    const out = settleNotDue([lane('web', 'stalled'), lane('core', 'stalled')], schedule, false, NOW);
    expect(out.map((l) => l.state)).toEqual(['stalled', 'stalled']);
  });
  it('PAUSED makes every stalled lane waiting', () => {
    expect(settleNotDue([lane('core', 'stalled')], undefined, true, NOW)[0]?.state).toBe('waiting');
  });
  it('leaves other states alone', () => {
    const out = settleNotDue([lane('docs', 'done'), lane('kit', 'blocked'), lane('web', 'building')], schedule, true, NOW);
    expect(out.map((l) => l.state)).toEqual(['done', 'blocked', 'building']);
  });
});
