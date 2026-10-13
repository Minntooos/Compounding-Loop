import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseScheduleBody, parseSteerBody } from '../../../src/server/actionBody.js';
import { createApp } from '../../../src/server/index.js';

const IDENT = { GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com' };
let root: string;
let dir: string;
const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, env: { ...process.env, ...IDENT }, encoding: 'utf8' });
const read = (rel: string) => readFileSync(path.join(dir, ...rel.split('/')), 'utf8');

beforeAll(() => {
  Object.assign(process.env, IDENT);
  root = mkdtempSync(path.join(tmpdir(), 'cl-steer-'));
  dir = path.join(root, 'laned');
  mkdirSync(path.join(dir, '.ai', 'lanes', 'core'), { recursive: true });
  writeFileSync(path.join(dir, '.ai', 'task.md'), '# Task\n\nRun: 1 / 5\n');
  writeFileSync(path.join(dir, '.ai', 'lanes.json'), JSON.stringify({ lanes: [{ name: 'core', owns: ['src/**'] }, { name: 'web', owns: ['web/**'] }] }));
  writeFileSync(path.join(dir, '.ai', 'schedule.json'), JSON.stringify({ version: 1, lanes: { core: { notBefore: null, sleeping: true, paused: false, reason: 'idle' } } }));
  git('init', '-q');
  git('config', 'user.name', 't');
  git('add', '-A');
  git('commit', '-qm', 'first');
});
afterAll(() => rmSync(root, { recursive: true, force: true, maxRetries: 5 }));

const post = async (action: string, body: unknown, id = 'laned') => {
  const app = await createApp({ demo: false, projectsDir: root });
  return app.request(`http://127.0.0.1:4321/api/loops/${id}/${action}`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
};

describe('parseSteerBody', () => {
  it('accepts a lane and text, defaults to next-run, and trims nothing it does not have to', () => {
    expect(parseSteerBody({ lane: 'core', text: 'do X' })).toEqual({ ok: true, value: { lane: 'core', text: 'do X', standing: false } });
    expect(parseSteerBody({ lane: 'core', text: 'x', standing: true, author: 'Ann' })).toEqual({ ok: true, value: { lane: 'core', text: 'x', standing: true, author: 'Ann' } });
  });
  it.each([undefined, null, 'x', {}, { lane: 'core' }, { lane: 'core', text: '  ' }, { lane: '', text: 'x' }, { lane: 'all', text: 'x' }, { lane: 'core', text: 'x', standing: 'yes' }])('rejects %j', (body) => {
    expect(parseSteerBody(body).ok).toBe(false);
  });
});

describe('parseScheduleBody', () => {
  it('maps each action', () => {
    expect(parseScheduleBody({ action: 'pause', lane: 'core', reason: 'rest' })).toEqual({ ok: true, value: { action: 'pause', lane: 'core', reason: 'rest' } });
    expect(parseScheduleBody({ action: 'snooze', lane: 'core', until: '3h' })).toEqual({ ok: true, value: { action: 'snooze', lane: 'core', until: '3h' } });
    expect(parseScheduleBody({ action: 'wake', lane: 'all' })).toEqual({ ok: true, value: { action: 'wake', lane: 'all' } });
    expect(parseScheduleBody({ action: 'resume', lane: 'core', until: 'ignored' })).toEqual({ ok: true, value: { action: 'resume', lane: 'core' } });
  });
  it.each([undefined, {}, { action: 'pause' }, { action: 'delete', lane: 'core' }, { action: 'snooze', lane: 'core' }])('rejects %j', (body) => {
    expect(parseScheduleBody(body).ok).toBe(false);
  });
});

describe('POST /api/loops/:id/steer', () => {
  it('writes the entry, wakes a sleeping lane and commits both with Lane: control', async () => {
    const res = await post('steer', { lane: 'core', text: 'Ship the parser first.', author: 'Ann' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, changed: true, lanes: ['core'], pushed: false });
    expect(read('.ai/lanes/core/steer.md')).toMatch(/## \d{4}-\d\d-\d\d \d\d:\d\d UTC · Ann · next-run\nShip the parser first\./);
    expect(JSON.parse(read('.ai/schedule.json')).lanes.core).toMatchObject({ sleeping: false, reason: 'woken: steer' });
    const message = git('log', '-1', '--format=%B');
    expect(message).toContain('Steer core (next-run)');
    expect(message).toContain('Lane: control');
  });

  it('records a standing entry', async () => {
    await post('steer', { lane: 'web', text: 'Keep the cards calm.', standing: true, author: 'Ann' });
    expect(read('.ai/lanes/web/steer.md')).toContain('· Ann · standing');
  });

  it('400s on a bad body, 422s on an unknown or unsafe lane, 404s on an unknown loop', async () => {
    expect((await post('steer', { lane: 'core' })).status).toBe(400);
    const unknown = await post('steer', { lane: 'nope', text: 'x', author: 'Ann' });
    expect(unknown.status).toBe(422);
    expect(((await unknown.json()) as { error: string }).error).toMatch(/No lane "nope"/);
    expect((await post('steer', { lane: '../x', text: 'x', author: 'Ann' })).status).toBe(422);
    expect((await post('steer', { lane: 'core', text: 'x' }, 'nope')).status).toBe(404);
  });

  it('is read-only in the demo and refuses cross-site posts', async () => {
    const demo = await (await createApp({ demo: true })).request('http://127.0.0.1:4321/api/loops/proj1/steer', { method: 'POST', body: JSON.stringify({ lane: 'core', text: 'x' }), headers: { 'content-type': 'application/json' } });
    expect(demo.status).toBe(409);
    const app = await createApp({ demo: false, projectsDir: root });
    const evil = await app.request('http://127.0.0.1:4321/api/loops/laned/steer', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json', origin: 'https://evil.example' } });
    expect(evil.status).toBe(403);
  });
});

describe('POST /api/loops/:id/schedule', () => {
  it('pauses, snoozes, resumes and wakes a lane, committing each change; repeating is a no-op', async () => {
    const paused = await post('schedule', { action: 'pause', lane: 'web', reason: 'rest' });
    expect(await paused.json()).toMatchObject({ ok: true, changed: true, lanes: ['web'] });
    expect(JSON.parse(read('.ai/schedule.json')).lanes.web).toMatchObject({ paused: true, reason: 'rest' });
    expect(git('log', '-1', '--format=%B')).toContain('Lane: control');
    expect(await (await post('schedule', { action: 'pause', lane: 'web', reason: 'rest' })).json()).toMatchObject({ changed: false, lanes: [] });

    expect(await (await post('schedule', { action: 'resume', lane: 'web' })).json()).toMatchObject({ changed: true });
    const snoozed = await post('schedule', { action: 'snooze', lane: 'web', until: '3h' });
    expect(snoozed.status).toBe(200);
    expect(Date.parse(JSON.parse(read('.ai/schedule.json')).lanes.web.notBefore)).toBeGreaterThan(Date.now());
    expect(await (await post('schedule', { action: 'wake', lane: 'all' })).json()).toMatchObject({ changed: true });
    expect(JSON.parse(read('.ai/schedule.json')).lanes.web.notBefore).toBeNull();
  });

  it('400s on a bad body and 422s on an unreadable time or unknown lane', async () => {
    expect((await post('schedule', { action: 'explode', lane: 'web' })).status).toBe(400);
    expect((await post('schedule', { action: 'snooze', lane: 'web' })).status).toBe(400);
    const bad = await post('schedule', { action: 'snooze', lane: 'web', until: 'someday' });
    expect(bad.status).toBe(422);
    expect(((await bad.json()) as { error: string }).error).toMatch(/Cannot read "someday"/);
    expect((await post('schedule', { action: 'pause', lane: 'ghost' })).status).toBe(422);
    expect((await post('schedule', { action: 'pause', lane: 'web' }, 'nope')).status).toBe(404);
  });

  it('is read-only in the demo', async () => {
    const demo = await (await createApp({ demo: true })).request('http://127.0.0.1:4321/api/loops/proj1/schedule', { method: 'POST', body: JSON.stringify({ action: 'wake', lane: 'all' }), headers: { 'content-type': 'application/json' } });
    expect(demo.status).toBe(409);
  });
});
