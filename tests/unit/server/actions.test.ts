import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../../src/server/index.js';

const IDENT = { GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com' };
let root: string;
let dir: string;
const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, env: { ...process.env, ...IDENT }, encoding: 'utf8' });

beforeAll(() => {
  Object.assign(process.env, IDENT); // runPause/runResume commit with the ambient identity
  root = mkdtempSync(path.join(tmpdir(), 'cl-actions-'));
  dir = path.join(root, 'laned');
  mkdirSync(path.join(dir, '.ai'), { recursive: true });
  writeFileSync(path.join(dir, '.ai', 'task.md'), '# Task\n\nRun: 1 / 5\n');
  writeFileSync(path.join(dir, 'IDEA.md'), '# Idea\n\nOld brief.\n');
  git('init', '-q');
  git('config', 'user.name', 't'); // runPause reads user.name; CI runners have none
  git('add', '-A');
  git('commit', '-qm', 'first');
});
afterAll(() => rmSync(root, { recursive: true, force: true, maxRetries: 5 }));

const post = async (action: string, body: unknown, id = 'laned') => {
  const app = await createApp({ demo: false, projectsDir: root });
  return app.request(`http://127.0.0.1:4321/api/loops/${id}/${action}`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
};

describe('POST /api/loops/:id/pause and /resume', () => {
  it('writes .ai/PAUSED with a Lane: control commit, then removes it; repeating is a no-op', async () => {
    const paused = await post('pause', { reason: 'lunch break' });
    expect(paused.status).toBe(200);
    expect(await paused.json()).toMatchObject({ ok: true, changed: true, by: expect.any(String), pushed: false });
    expect(readFileSync(path.join(dir, '.ai', 'PAUSED'), 'utf8')).toContain('lunch break');
    expect(git('log', '-1', '--format=%B')).toContain('Lane: control');
    expect(await (await post('pause', {})).json()).toMatchObject({ changed: false });

    expect(await (await post('resume', {})).json()).toMatchObject({ ok: true, changed: true });
    expect(existsSync(path.join(dir, '.ai', 'PAUSED'))).toBe(false);
    expect(await (await post('resume', {})).json()).toMatchObject({ changed: false });
  });

  it('404s for an unknown loop and never resolves an id as a path', async () => {
    expect((await post('pause', {}, 'nope')).status).toBe(404);
    expect((await post('resume', {}, '..%2Flaned')).status).toBe(404);
  });

  it('refuses cross-site posts and is read-only in the demo', async () => {
    const app = await createApp({ demo: false, projectsDir: root });
    const evil = await app.request('http://127.0.0.1:4321/api/loops/laned/pause', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json', origin: 'https://evil.example' } });
    expect(evil.status).toBe(403);
    expect(existsSync(path.join(dir, '.ai', 'PAUSED'))).toBe(false);
    const demo = await (await createApp({ demo: true })).request('http://127.0.0.1:4321/api/loops/proj1/pause', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } });
    expect(demo.status).toBe(409);
  });
});

describe('POST /api/loops/:id/next-round', () => {
  it('needs a brief', async () => {
    expect((await post('next-round', { brief: '  ' })).status).toBe(400);
    expect((await post('next-round', {})).status).toBe(400);
  });

  it('explains when the loop has no lanes, and leaves no brief file behind', async () => {
    const res = await post('next-round', { brief: '# Round 2\n\nShip it.' });
    expect(res.status).toBe(422);
    expect(((await res.json()) as { error: string }).error).toMatch(/lanes\.json/);
    expect(existsSync(path.join(dir, '.ai', 'next-round.md'))).toBe(false);
  });
});

describe('action limits', () => {
  it('refuses an oversized body', async () => {
    const app = await createApp({ demo: false, projectsDir: root });
    const big = JSON.stringify({ brief: 'x'.repeat(70_000) });
    const res = await app.request('http://127.0.0.1:4321/api/loops/laned/next-round', { method: 'POST', body: big, headers: { 'content-type': 'application/json', 'content-length': String(big.length) } });
    expect(res.status).toBe(413);
  });
});

describe('GET /api/doctor', () => {
  it('returns the local report, and a pointer in the demo', async () => {
    const fake = await createApp({
      demo: false,
      projectsDir: root,
      source: { loops: async () => [], loop: async () => undefined, inbox: async () => [], checks: async () => [], doctor: async () => ({ report: 'node ok', passed: true }) },
    });
    expect(await (await fake.request('/api/doctor')).json()).toEqual({ report: 'node ok', passed: true });
    const demo = (await (await (await createApp({ demo: true })).request('/api/doctor')).json()) as { report: string };
    expect(demo.report).toMatch(/npx compounding-loop doctor/);
  });
});
