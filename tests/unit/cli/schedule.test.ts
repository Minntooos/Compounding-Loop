import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formatScheduleReport, readSchedule, runScheduleAction, runScheduleShow, runScheduleUpdate, runSteer } from '../../../src/cli/schedule.js';
import { parseUntil } from '../../../src/core/parse/schedule.js';
import { parseSteer } from '../../../src/core/parse/steer.js';

describe('loop schedule / loop steer', () => {
  let dir: string;
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  const put = async (rel: string, text: string) => {
    await mkdir(path.dirname(path.join(dir, rel)), { recursive: true });
    await writeFile(path.join(dir, rel), text);
  };
  const run = (lane: string, at: string, units: string[] = []) => put(`.ai/lanes/${lane}/runs.jsonl`, `${JSON.stringify({ at, lane, units, pushed: units.length > 0 })}\n`);
  const o = { push: false, now: new Date('2026-10-13T12:00:00Z') };

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'loop-schedule-'));
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 't@example.com');
    git('config', 'user.name', 'Tess');
    git('config', 'commit.gpgsign', 'false');
    await put('.ai/lanes.json', JSON.stringify({ lanes: [{ name: 'api', owns: ['src/**'] }, { name: 'web', owns: ['web/**'] }] }));
    git('add', '-A');
    git('commit', '-qm', 'init');
  });
  afterEach(() => rm(dir, { recursive: true, force: true, maxRetries: 5 }));

  it('show: every lane is due without a file; --json shape', async () => {
    const report = await runScheduleShow(dir, o.now);
    expect(report.lanes.map((l) => [l.lane, l.state])).toEqual([['api', 'due'], ['web', 'due']]);
    expect(formatScheduleReport(report)).toContain('api');
    expect(formatScheduleReport({ lanes: [] })).toContain('No lanes');
  });

  it('pause and resume write the file, commit with Lane: control and keep the tree clean', async () => {
    const r = await runScheduleAction(dir, { action: 'pause', lane: 'api', reason: ' on  holiday ' }, o);
    expect(r).toMatchObject({ changed: ['api'], committed: true });
    expect((await readSchedule(dir)).lanes.api).toMatchObject({ paused: true, reason: 'on holiday' });
    expect(git('log', '-1', '--format=%B')).toContain('Lane: control');
    expect(git('status', '--porcelain')).toBe('');
    expect((await runScheduleShow(dir, o.now)).lanes[0]?.state).toBe('paused');
    await runScheduleAction(dir, { action: 'resume', lane: 'api' }, o);
    expect((await readSchedule(dir)).lanes.api).toMatchObject({ paused: false, reason: null });
  });

  it('a repeated action changes nothing and makes no commit', async () => {
    await runScheduleAction(dir, { action: 'pause', lane: 'api' }, o);
    const count = git('rev-list', '--count', 'HEAD');
    expect(await runScheduleAction(dir, { action: 'pause', lane: 'api' }, o)).toMatchObject({ changed: [], committed: false });
    expect(git('rev-list', '--count', 'HEAD')).toBe(count);
  });

  it('--no-commit writes the file only', async () => {
    const r = await runScheduleAction(dir, { action: 'pause', lane: 'api' }, { ...o, commit: false });
    expect(r.committed).toBe(false);
    expect(git('status', '--porcelain')).toContain('schedule.json');
  });

  it('snooze sets notBefore from a span or a date, and refuses the past or nonsense', async () => {
    await runScheduleAction(dir, { action: 'snooze', lane: 'web', until: '3h' }, o);
    expect((await readSchedule(dir)).lanes.web).toMatchObject({ notBefore: '2026-10-13T15:00:00.000Z', reason: 'snoozed by owner' });
    await expect(runScheduleAction(dir, { action: 'snooze', lane: 'web', until: 'yesterday' }, o)).rejects.toThrow(/future time/);
    await expect(runScheduleAction(dir, { action: 'snooze', lane: 'web', until: '2020-01-01' }, o)).rejects.toThrow(/future time/);
  });

  it('wake clears sleeping and snooze for one lane or all, and rejects an unknown lane', async () => {
    await put('.ai/schedule.json', JSON.stringify({ version: 1, lanes: { api: { notBefore: null, sleeping: true, paused: false, reason: 'x' }, web: { notBefore: '2026-10-14T00:00:00Z', sleeping: false, paused: false, reason: null } } }));
    const r = await runScheduleAction(dir, { action: 'wake', lane: 'all' }, o);
    expect(r.changed.sort()).toEqual(['api', 'web']);
    const s = await readSchedule(dir);
    expect(s.lanes.api).toMatchObject({ sleeping: false, notBefore: null });
    expect(s.lanes.web?.notBefore).toBeNull();
    await expect(runScheduleAction(dir, { action: 'wake', lane: 'nope' }, o)).rejects.toThrow(/No lane/);
    await expect(runScheduleAction(dir, { action: 'wake', lane: '../x' }, o)).rejects.toThrow(/not a lane name/);
  });

  it('update applies the backoff: 1 idle -> +3 h, 2 -> +6 h, 3 -> sleeping, units reset', async () => {
    await put('.ai/lanes/api/runs.jsonl', ['2026-10-13T06:00:00Z', '2026-10-13T09:00:00Z'].map((at) => JSON.stringify({ at, lane: 'api', units: [], pushed: false })).join('\n') + '\n');
    await run('web', '2026-10-13T09:00:00Z', ['u']);
    const r = await runScheduleUpdate(dir, o);
    expect(r.changed).toEqual(['api']);
    expect((await readSchedule(dir)).lanes.api).toMatchObject({ notBefore: '2026-10-13T15:00:00.000Z', sleeping: false });
    await put('.ai/lanes/api/runs.jsonl', ['03', '06', '09'].map((h) => JSON.stringify({ at: `2026-10-13T${h}:00:00Z`, lane: 'api', units: [], pushed: false })).join('\n') + '\n');
    await runScheduleUpdate(dir, o);
    expect((await readSchedule(dir)).lanes.api).toMatchObject({ sleeping: true, notBefore: null });
  });

  it('update wakes a sleeping lane on a steer entry, a newer message to it, or a new round', async () => {
    const sleeping = { notBefore: null, sleeping: true, paused: false, reason: 'x' };
    await put('.ai/schedule.json', JSON.stringify({ version: 1, lanes: { api: sleeping, web: sleeping } }));
    await put('.ai/lanes/api/steer.md', '# s\n\n## 2026-10-13 11:00 UTC · owner · next-run\ndo it\n');
    await run('web', '2026-10-13T08:00:00Z');
    await put('.ai/lanes/api/outbox.md', '# o\n\n2026-10-13 11:00 UTC · to web · hello\n');
    const r = await runScheduleUpdate(dir, { ...o, commit: false });
    expect(r.woken).toEqual({ api: ['steer'], web: ['message'] });
    const s = await readSchedule(dir);
    expect(s.lanes.api?.sleeping).toBe(false);
    expect(s.lanes.web?.sleeping).toBe(false);
  });

  it('update does not put a manually woken lane back to sleep until it logs a run', async () => {
    await put('.ai/lanes/api/runs.jsonl', ['03', '06', '09'].map((h) => JSON.stringify({ at: `2026-10-13T${h}:00:00Z`, lane: 'api', units: [], pushed: false })).join('\n') + '\n');
    await runScheduleUpdate(dir, o);
    await runScheduleAction(dir, { action: 'wake', lane: 'api' }, o);
    await runScheduleUpdate(dir, o);
    expect((await readSchedule(dir)).lanes.api?.sleeping).toBe(false);
    await run('api', '2026-10-13T13:00:00Z');
    await runScheduleUpdate(dir, { ...o, now: new Date('2026-10-13T14:00:00Z') });
    expect((await readSchedule(dir)).lanes.api?.notBefore).toBe('2026-10-13T16:00:00.000Z');
  });

  it('update --lane touches only that lane and commits as that lane', async () => {
    for (const lane of ['api', 'web']) await run(lane, '2026-10-13T09:00:00Z');
    const r = await runScheduleUpdate(dir, { ...o, lane: 'api' });
    expect(r.changed).toEqual(['api']);
    expect((await readSchedule(dir)).lanes.web).toBeUndefined();
    expect(git('log', '-1', '--format=%B')).toContain('Lane: api');
    await expect(runScheduleUpdate(dir, { ...o, lane: 'nope' })).rejects.toThrow(/No lane/);
  });

  it('update leaves a paused lane alone and --new-round wakes sleepers', async () => {
    await put('.ai/schedule.json', JSON.stringify({ version: 1, lanes: { api: { notBefore: null, sleeping: false, paused: true, reason: 'p' }, web: { notBefore: null, sleeping: true, paused: false, reason: 's' } } }));
    const r = await runScheduleUpdate(dir, { ...o, newRound: true });
    expect(r.changed).toEqual(['web']);
    expect((await readSchedule(dir)).lanes.api?.paused).toBe(true);
  });

  it('steer writes a newest-first entry, wakes the lane, and commits both files with Lane: control', async () => {
    await put('.ai/schedule.json', JSON.stringify({ version: 1, lanes: { api: { notBefore: null, sleeping: true, paused: false, reason: 'idle' } } }));
    git('add', '-A');
    git('commit', '-qm', 'sched');
    await runSteer(dir, 'api', 'First', o);
    await runSteer(dir, 'api', 'Second\nline', { ...o, standing: true, author: 'Ana', now: new Date('2026-10-13T13:00:00Z') });
    const entries = parseSteer(await readFile(path.join(dir, '.ai/lanes/api/steer.md'), 'utf8'));
    expect(entries.map((e) => [e.text, e.scope, e.author])).toEqual([['Second\nline', 'standing', 'Ana'], ['First', 'next-run', 'Tess']]);
    expect((await readSchedule(dir)).lanes.api?.sleeping).toBe(false);
    expect(git('log', '-1', '--format=%B')).toContain('Lane: control');
    expect(git('status', '--porcelain')).toBe('');
  });

  it('steer rejects empty text, an unknown lane and a missing author', async () => {
    await expect(runSteer(dir, 'api', '  ', o)).rejects.toThrow(/Say what/);
    await expect(runSteer(dir, 'nope', 'x', o)).rejects.toThrow(/No lane/);
    git('config', '--unset', 'user.name');
    await expect(runSteer(dir, 'api', 'x', { ...o, commit: false, author: ' ' })).rejects.toThrow(/who you are/);
  });
});

describe('parseUntil', () => {
  const now = new Date('2026-10-13T12:00:00Z');
  it('reads spans, dates and ISO times; rejects past and nonsense', () => {
    expect(parseUntil('90m', now)?.toISOString()).toBe('2026-10-13T13:30:00.000Z');
    expect(parseUntil('+2d', now)?.toISOString()).toBe('2026-10-15T12:00:00.000Z');
    expect(parseUntil('2026-10-14', now)?.toISOString()).toBe('2026-10-14T00:00:00.000Z');
    expect(parseUntil('2026-10-13T18:00:00Z', now)).toBeDefined();
    expect(parseUntil('2026-10-13T11:00:00Z', now)).toBeUndefined();
    expect(parseUntil('soon', now)).toBeUndefined();
  });
});
