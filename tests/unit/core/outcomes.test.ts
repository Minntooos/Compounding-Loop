import { describe, expect, it } from 'vitest';
import { classifyRunSlots, missedRun, type ClassifyInput } from '../../../src/core/parse/outcomes.js';
import type { RunEntry } from '../../../src/core/parse/runs.js';
import { emptySchedule } from '../../../src/core/parse/schedule.js';

const d = (s: string) => new Date(s);
const run = (at: string, o: Partial<RunEntry> = {}): RunEntry => ({ at, lane: 'api', units: ['u'], pushed: true, ...o });
const now = d('2026-10-13T12:30:00Z');
// slots at 07:07 every hour: 09:07 .. 12:07 inside the 4 h window
const base = (over: Partial<ClassifyInput> = {}): ClassifyInput => ({
  lanes: [{ name: 'api', cron: '7 * * * *' }],
  runs: new Map(),
  schedule: emptySchedule(),
  paused: false,
  rootDone: false,
  laneDone: new Set(),
  now,
  from: d('2026-10-13T08:30:00Z'),
  ...over,
});
const kinds = (i: ClassifyInput) => classifyRunSlots(i).lanes[0]?.slots.map((s) => s.kind);

describe('classifyRunSlots', () => {
  it('worked, idle, tests-failed, missed and running', () => {
    const runs = new Map([['api', [run('2026-10-13T09:40:00Z'), run('2026-10-13T10:40:00Z', { units: [], pushed: false }), run('2026-10-13T11:40:00Z', { tests: { passed: 1, failed: 2 } })]]]);
    // slots: 09:07 worked, 10:07 idle, 11:07 tests-failed, 12:07 (23 min before now) running
    expect(kinds(base({ runs }))).toEqual(['worked', 'idle', 'tests-failed', 'running']);
  });
  it('a due slot whose window passed with no line is missed', () => {
    expect(kinds(base({ now: d('2026-10-13T14:30:00Z'), from: d('2026-10-13T11:30:00Z') }))).toEqual(['missed', 'missed', 'running']);
  });
  it('a lane that is not due in schedule.json expects nothing after its last run', () => {
    const schedule = { version: 1 as const, lanes: { api: { notBefore: '2026-10-13T11:30:00Z', sleeping: false, paused: false, reason: null } } };
    const runs = new Map([['api', [run('2026-10-13T09:40:00Z')]]]);
    expect(kinds(base({ schedule, runs }))).toEqual(['worked', 'not-due', 'not-due', 'running']);
    expect(kinds(base({ schedule: { version: 1, lanes: { api: { notBefore: null, sleeping: true, paused: false, reason: null } } } }))).toEqual(['not-due', 'not-due', 'not-due', 'not-due']);
  });
  it('a later run proves the lane was due, whatever the schedule says now', () => {
    const schedule = { version: 1 as const, lanes: { api: { notBefore: null, sleeping: true, paused: false, reason: null } } };
    const runs = new Map([['api', [run('2026-10-13T12:20:00Z')]]]);
    expect(kinds(base({ schedule, runs, now: d('2026-10-13T13:30:00Z') }))).toContain('missed');
  });
  it('paused loop: no misses', () => {
    expect(kinds(base({ paused: true, now: d('2026-10-13T12:30:00Z') }))).toEqual(['paused', 'paused', 'paused', 'paused']);
  });
  it('root DONE and lane DONE/BLOCKED: nothing expected, but real runs keep their outcome', () => {
    const runs = new Map([['api', [run('2026-10-13T09:40:00Z')]]]);
    expect(kinds(base({ rootDone: true, runs }))).toEqual(['worked', 'done', 'done', 'done']);
    expect(kinds(base({ laneDone: new Set(['api']) }))).toEqual(['done', 'done', 'done', 'done']);
  });
  it('a lane without a cron has no slots', () => {
    expect(classifyRunSlots(base({ lanes: [{ name: 'api' }] })).lanes[0]?.slots).toEqual([]);
  });
  it('a commit with the lane trailer counts as worked', () => {
    expect(kinds(base({ commits: new Map([['api', [d('2026-10-13T10:20:00Z')]]]) }))).toEqual(['missed', 'worked', 'missed', 'running']);
  });
  it('routines look off after 6 h of silence with due slots; not when paused, done or quiet', () => {
    const late = base({ now: d('2026-10-13T20:30:00Z'), from: d('2026-10-13T08:30:00Z'), runs: new Map([['api', [run('2026-10-13T09:40:00Z')]]]) });
    expect(classifyRunSlots(late).routinesLookOff).toBe(true);
    expect(classifyRunSlots({ ...late, paused: true }).routinesLookOff).toBe(false);
    expect(classifyRunSlots({ ...late, rootDone: true }).routinesLookOff).toBe(false);
    expect(classifyRunSlots(base({ runs: new Map([['api', [run('2026-10-13T12:20:00Z')]]]) })).routinesLookOff).toBe(false);
    expect(classifyRunSlots({ ...late, schedule: { version: 1, lanes: { api: { notBefore: null, sleeping: true, paused: false, reason: null } } } }).routinesLookOff).toBe(false);
  });
});

describe('missedRun', () => {
  const slot = (kind: ClassifyInputKind) => ({ slot: 'x', outcome: 'no-run-recorded' as const, kind });
  type ClassifyInputKind = Parameters<typeof missedRun>[0][number]['kind'];
  it('counts due misses from the newest, skipping not-due and running slots', () => {
    expect(missedRun([slot('worked'), slot('missed'), slot('not-due'), slot('missed'), slot('running')])).toBe(2);
    expect(missedRun([slot('missed'), slot('worked')])).toBe(0);
    expect(missedRun([])).toBe(0);
  });
});
