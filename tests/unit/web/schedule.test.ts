import { describe, expect, it } from 'vitest';
import { laneScheduleState, steerAckChip } from '../../../web/src/lib/schedule.js';

const now = new Date('2026-10-13T12:40:00Z');
const entry = (over: Partial<{ notBefore: string | null; sleeping: boolean; paused: boolean; reason: string | null }>) => ({ notBefore: null, sleeping: false, paused: false, reason: null, ...over });

describe('laneScheduleState', () => {
  it('a lane with no entry is due, and says how many idle runs it has had', () => {
    expect(laneScheduleState({ now })).toEqual({ kind: 'due', text: 'Due' });
    expect(laneScheduleState({ now, idleRuns: 1 })).toEqual({ kind: 'due', text: 'Due · 1 idle run in a row' });
  });
  it('sleeping names the idle runs and the reason', () => {
    expect(laneScheduleState({ now, entry: entry({ sleeping: true, reason: 'docs waits' }), idleRuns: 3 }))
      .toEqual({ kind: 'sleeping', text: 'Sleeping · 3 idle runs · docs waits' });
  });
  it('snoozed shows the time, with the date when it is another day', () => {
    expect(laneScheduleState({ now, entry: entry({ notBefore: '2026-10-13T15:15:00Z', reason: 'idle twice in a row' }) }).text)
      .toBe('Snoozed until 15:15 UTC · idle twice in a row');
    expect(laneScheduleState({ now, entry: entry({ notBefore: '2026-10-14T09:00:00Z' }) }).text).toMatch(/^Snoozed until .*14 Oct.*09:00/);
  });
  it('a snooze in the past is due again', () => {
    expect(laneScheduleState({ now, entry: entry({ notBefore: '2026-10-13T10:00:00Z' }) }).kind).toBe('due');
  });
  it('paused beats sleeping, and the whole loop paused beats both', () => {
    expect(laneScheduleState({ now, entry: entry({ paused: true, sleeping: true, reason: 'release week' }) })).toEqual({ kind: 'paused', text: 'Paused · release week' });
    expect(laneScheduleState({ now, entry: entry({ paused: true }), loopPaused: true })).toEqual({ kind: 'loop-paused', text: 'Paused with the whole loop' });
  });
});

describe('steerAckChip', () => {
  it('has one chip per acknowledgement state', () => {
    expect(steerAckChip(undefined)).toEqual({ tone: 'muted', text: 'waiting for the next run' });
    expect(steerAckChip({ state: 'done', run: 7 })).toEqual({ tone: 'done', text: 'done in run 7' });
    expect(steerAckChip({ state: 'not-done', why: 'conflicts with a hard rule' })).toEqual({ tone: 'blocked', text: 'not done: conflicts with a hard rule' });
  });
});
