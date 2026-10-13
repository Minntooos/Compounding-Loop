import { describe, expect, it } from 'vitest';
import * as parse from '../../../src/core/parse/index.js';
import type { RunEntry } from '../../../src/core/parse/runs.js';
import {
  applyBackoff, dueEntry, emptySchedule, formatSchedule, isBackedOff, isDue, notDueReason, parseSchedule, trailingIdleRuns, wakeEntry, wakeReasons,
} from '../../../src/core/parse/schedule.js';
import { addSteerEntry, formatSteerEntry, parseSteer, standingEntries, steerHeading, steerOrder, steerPath, unacknowledged } from '../../../src/core/parse/steer.js';

const run = (at: string, units: string[] = []): RunEntry => ({ at, lane: 'core', units, pushed: units.length > 0 });
const now = new Date('2026-10-13T12:00:00Z');

describe('parseSchedule / formatSchedule', () => {
  it('reads the file and fills defaults', () => {
    const s = parseSchedule('{"version":1,"lanes":{"docs":{"notBefore":"2026-10-13T18:00:00Z","reason":"waits"},"core":{}}}');
    expect(s.lanes.docs).toEqual({ notBefore: '2026-10-13T18:00:00Z', sleeping: false, paused: false, reason: 'waits' });
    expect(s.lanes.core).toEqual(dueEntry());
  });
  it('treats unreadable input as everything due', () => {
    for (const bad of ['', 'not json', '[]', '{"lanes":[]}', '{"lanes":5}']) expect(parseSchedule(bad)).toEqual(emptySchedule());
  });
  it('drops an unreadable notBefore instead of holding the lane back forever', () => {
    expect(parseSchedule('{"lanes":{"a":{"notBefore":"soon"}}}').lanes.a?.notBefore).toBeNull();
  });
  it('round-trips through formatSchedule', () => {
    const s = { version: 1 as const, lanes: { core: { ...dueEntry(), sleeping: true, reason: 'x' }, kit: dueEntry() } };
    expect(parseSchedule(formatSchedule(s))).toEqual(s);
    expect(formatSchedule(emptySchedule())).toBe('{\n  "version": 1,\n  "lanes": {\n  }\n}\n');
  });
});

describe('isDue / notDueReason', () => {
  it('a missing entry is due', () => {
    expect(isDue(undefined, now)).toBe(true);
    expect(notDueReason(undefined, now)).toBeUndefined();
  });
  it('names why a lane is not due, pause first', () => {
    expect(notDueReason({ ...dueEntry(), paused: true, sleeping: true }, now)).toBe('paused');
    expect(notDueReason({ ...dueEntry(), sleeping: true }, now)).toBe('sleeping');
    expect(notDueReason({ ...dueEntry(), notBefore: '2026-10-13T12:00:01Z' }, now)).toBe('snoozed');
  });
  it('notBefore in the past or equal to now is due', () => {
    expect(isDue({ ...dueEntry(), notBefore: '2026-10-13T12:00:00Z' }, now)).toBe(true);
    expect(isDue({ ...dueEntry(), notBefore: '2026-10-13T01:00:00Z' }, now)).toBe(true);
  });
  it('isBackedOff is false for an owner pause', () => {
    expect(isBackedOff({ ...dueEntry(), paused: true }, now)).toBe(false);
    expect(isBackedOff({ ...dueEntry(), sleeping: true }, now)).toBe(true);
    expect(isBackedOff(undefined, now)).toBe(false);
  });
});

describe('applyBackoff', () => {
  it('counts idle runs at the end only; units reset the count', () => {
    expect(trailingIdleRuns([run('2026-10-13T01:00:00Z'), run('2026-10-13T02:00:00Z', ['u']), run('2026-10-13T03:00:00Z')])).toBe(1);
    expect(trailingIdleRuns([run('2026-10-13T01:00:00Z', ['u'])])).toBe(0);
    expect(trailingIdleRuns([])).toBe(0);
  });
  it('one idle run: last run + 3 h', () => {
    const e = applyBackoff([run('2026-10-13T09:00:00Z')], undefined, now);
    expect(e).toMatchObject({ notBefore: '2026-10-13T12:00:00.000Z', sleeping: false, reason: '1 idle run in a row' });
  });
  it('two in a row: last run + 6 h, whatever order the log is in', () => {
    const e = applyBackoff([run('2026-10-13T09:00:00Z'), run('2026-10-13T03:00:00Z')], dueEntry(), now);
    expect(e.notBefore).toBe('2026-10-13T15:00:00.000Z');
    expect(e.reason).toBe('2 idle runs in a row');
  });
  it('three or more: sleeping, no notBefore', () => {
    const runs = ['01', '04', '07', '10'].map((h) => run(`2026-10-13T${h}:00:00Z`));
    expect(applyBackoff(runs, { ...dueEntry(), notBefore: '2026-10-13T20:00:00Z' }, now)).toMatchObject({ sleeping: true, notBefore: null, reason: '4 idle runs in a row' });
  });
  it('a run with units leaves the entry alone (never invents a wake-up)', () => {
    const entry = { ...dueEntry(), notBefore: '2026-10-14T00:00:00Z' };
    expect(applyBackoff([run('2026-10-13T09:00:00Z', ['u'])], entry, now)).toBe(entry);
  });
  it('never touches a paused lane', () => {
    const entry = { ...dueEntry(), paused: true };
    expect(applyBackoff([run('2026-10-13T09:00:00Z')], entry, now)).toBe(entry);
  });
});

describe('wakeReasons / wakeEntry', () => {
  const base = { lane: 'core', lastRunAt: '2026-10-13T10:00:00.000Z', steer: [], messages: [] };
  const steerOpen = parseSteer('## 2026-10-13 11:00 UTC · owner · next-run\nDo x\n');
  it('nothing new: keep sleeping', () => expect(wakeReasons(base)).toEqual([]));
  it('an unacknowledged steer entry wakes', () => expect(wakeReasons({ ...base, steer: steerOpen })).toEqual(['steer']));
  it('an acknowledged one does not', () => {
    const done = parseSteer('## 2026-10-13 11:00 UTC · owner · next-run\nDo x\n→ done in run 2\n');
    expect(wakeReasons({ ...base, steer: done })).toEqual([]);
  });
  it('a newer message to the lane or all wakes; older or other lanes do not', () => {
    expect(wakeReasons({ ...base, messages: [{ at: '2026-10-13T10:30:00.000Z', to: ['core', 'kit'] }] })).toEqual(['message']);
    expect(wakeReasons({ ...base, messages: [{ at: '2026-10-13T10:30:00.000Z', to: ['all'] }] })).toEqual(['message']);
    expect(wakeReasons({ ...base, messages: [{ at: '2026-10-13T09:30:00.000Z', to: ['core'] }] })).toEqual([]);
    expect(wakeReasons({ ...base, messages: [{ at: '2026-10-13T10:30:00.000Z', to: ['web'] }] })).toEqual([]);
  });
  it('a lane that never ran is woken by any message; a new round wakes', () => {
    expect(wakeReasons({ lane: 'core', steer: [], messages: [{ at: '2026-10-13T10:30:00.000Z', to: ['core'] }], newRound: true })).toEqual(['message', 'new-round']);
  });
  it('wakeEntry clears sleeping and notBefore but keeps a pause', () => {
    expect(wakeEntry({ notBefore: 'x', sleeping: true, paused: false, reason: 'r' })).toEqual(dueEntry());
    expect(wakeEntry({ ...dueEntry(), paused: true }).paused).toBe(true);
    expect(wakeEntry(undefined)).toEqual(dueEntry());
  });
});

describe('steer parser', () => {
  const file = `# Steering for the core lane

Intro with an inline \`## YYYY-MM-DD HH:MM UTC · <author> · next-run|standing\` example.

## 2026-10-13 12:00 UTC · Ada · standing
Keep commits small.
→ done in run 3

## 2026-10-13 11:00 UTC · owner · next-run
Ship the parser first.
Second line.

## 2026-10-13 10:00 UTC · owner · next-run
Skipped one.
→ not done: conflicts with IDEA.md

## Not an entry
text
`;
  it('reads entries, author, scope and acknowledgement', () => {
    const e = parseSteer(file);
    expect(e).toHaveLength(3);
    expect(e[0]).toEqual({ at: '2026-10-13T12:00:00.000Z', author: 'Ada', scope: 'standing', text: 'Keep commits small.', ack: { state: 'done', run: 3 } });
    expect(e[1]).toMatchObject({ author: 'owner', scope: 'next-run', text: 'Ship the parser first.\nSecond line.' });
    expect(e[1]?.ack).toBeUndefined();
    expect(e[2]?.ack).toEqual({ state: 'not-done', why: 'conflicts with IDEA.md' });
  });
  it('ignores the intro and headings that are not entries; empty input is empty', () => {
    expect(parseSteer('')).toEqual([]);
    expect(parseSteer('# t\n\nNo entries.\n')).toEqual([]);
  });
  it('unacknowledged, steerOrder and standingEntries', () => {
    const e = parseSteer(file);
    expect(unacknowledged(e)).toHaveLength(1);
    expect(steerOrder(e).map((x) => x.scope)).toEqual(['next-run', 'standing']);
    expect(standingEntries(e)).toHaveLength(1);
  });
  it('steerOrder puts the newest next-run first', () => {
    const e = parseSteer('## 2026-10-13 09:00 UTC · a · next-run\nold\n\n## 2026-10-13 10:00 UTC · a · next-run\nnew\n');
    expect(steerOrder(e).map((x) => x.text)).toEqual(['new', 'old']);
  });
  it('steerPath', () => expect(steerPath('core')).toBe('.ai/lanes/core/steer.md'));
});

describe('writing steer entries', () => {
  const at = new Date('2026-10-13T12:34:56Z');
  it('formats the heading to the minute', () => {
    expect(steerHeading(at, 'owner', 'standing')).toBe('## 2026-10-13 12:34 UTC · owner · standing');
    expect(formatSteerEntry({ at, author: 'owner', scope: 'next-run', text: '  Do it.  ' })).toBe('## 2026-10-13 12:34 UTC · owner · next-run\nDo it.\n');
  });
  it('keeps the author from breaking the heading', () => {
    const text = formatSteerEntry({ at, author: 'a · b\nc', scope: 'next-run', text: 'x' });
    expect(parseSteer(text)[0]?.author).toBe('a b c');
  });
  it('round-trips through parseSteer', () => {
    const [e] = parseSteer(formatSteerEntry({ at, author: 'owner', scope: 'standing', text: 'Line 1\nLine 2' }));
    expect(e).toMatchObject({ at: '2026-10-13T12:34:00.000Z', author: 'owner', scope: 'standing', text: 'Line 1\nLine 2' });
  });
  it('adds the newest entry first, below the intro, and keeps the rest', () => {
    const file = '# Steering\n\nIntro.\n\n## 2026-10-13 10:00 UTC · a · next-run\nOld\n';
    const out = addSteerEntry(file, { at, author: 'b', scope: 'next-run', text: 'New' });
    expect(parseSteer(out).map((x) => x.text)).toEqual(['New', 'Old']);
    expect(out.startsWith('# Steering\n\nIntro.\n\n## 2026-10-13 12:34')).toBe(true);
  });
  it('appends to a file with no entries and creates from empty', () => {
    expect(addSteerEntry('# Steering\n', { at, author: 'b', scope: 'next-run', text: 'New' })).toBe('# Steering\n\n## 2026-10-13 12:34 UTC · b · next-run\nNew\n');
    expect(parseSteer(addSteerEntry('', { at, author: 'b', scope: 'next-run', text: 'New' }))).toHaveLength(1);
  });
});

describe('review fixes', () => {
  it('a body line starting with "## " does not cut the entry or lose its ack', () => {
    const at = new Date('2026-10-13T12:34:00Z');
    const text = `${formatSteerEntry({ at, author: 'o', scope: 'next-run', text: 'Do X\n## Plan\nmore' })}→ done in run 3\n`;
    expect(parseSteer(text)[0]).toMatchObject({ ack: { state: 'done', run: 3 } });
    expect(parseSteer(text)[0]?.text).toContain('more');
  });
  it('wakeReasons reads outbox-style times and mixed-case names', () => {
    expect(wakeReasons({ lane: 'core', lastRunAt: '2026-10-13T01:00:00Z', steer: [], messages: [{ at: '2026-10-13 02:00 UTC', to: ['Core'] }] })).toEqual(['message']);
  });
  it('a later owner snooze survives the backoff', () => {
    const e = applyBackoff([run('2026-10-13T09:00:00Z')], { ...dueEntry(), notBefore: '2026-10-14T00:00:00Z' }, now);
    expect(e.notBefore).toBe('2026-10-14T00:00:00.000Z');
  });
});

describe('browser-safe entry point', () => {
  it('exports the schedule and steer parsers', () => {
    expect(typeof parse.parseSchedule).toBe('function');
    expect(typeof parse.parseSteer).toBe('function');
    expect(typeof parse.wakeReasons).toBe('function');
  });
});
