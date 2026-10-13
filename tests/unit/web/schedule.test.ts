import { describe, expect, it } from 'vitest';
import { laneScheduleState, scheduleClock, steerAckChip } from '../../../web/src/lib/schedule.js';

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
  it('the backoff reason already names the idle runs, so the count is not said twice', () => {
    expect(laneScheduleState({ now, entry: entry({ sleeping: true, reason: '3 idle runs in a row' }), idleRuns: 3 }).text).toBe('Sleeping · 3 idle runs in a row');
  });
  it('a finished or blocked lane is stopped, not due', () => {
    expect(laneScheduleState({ now, idleRuns: 2, laneState: 'done' })).toEqual({ kind: 'stopped', text: 'Finished · no more runs' });
    expect(laneScheduleState({ now, laneState: 'blocked' })).toEqual({ kind: 'stopped', text: 'Stopped until its question is answered' });
    expect(laneScheduleState({ now, laneState: 'building' }).kind).toBe('due');
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
    expect(steerAckChip(undefined, 'done')).toEqual({ tone: 'blocked', text: 'not picked up: the lane is finished' });
    expect(steerAckChip(undefined, 'blocked').text).toBe('waiting until the lane’s question is answered');
    expect(steerAckChip({ state: 'done', run: 7 }, 'done').text).toBe('done in run 7');
    expect(steerAckChip({ state: 'not-done', why: 'conflicts with a hard rule' })).toEqual({ tone: 'blocked', text: 'not done: conflicts with a hard rule' });
  });
});

describe('scheduleClock', () => {
  it('live and local data are read now; a snapshot at its newest moment', () => {
    expect(scheduleClock({}, now)).toBe(now);
    expect(scheduleClock({ snapshotAt: '2026-10-11T14:51:27Z', lastRun: { lane: 'web', at: '2026-10-13T12:35:00Z', outcome: 'pushed' } }, new Date('2026-10-20T00:00:00Z')).toISOString()).toBe('2026-10-13T12:35:00.000Z');
    expect(scheduleClock({ snapshotAt: '2026-10-11T14:51:27Z' }, now).toISOString()).toBe('2026-10-11T14:51:27.000Z');
  });
});
