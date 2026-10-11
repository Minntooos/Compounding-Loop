import { describe, expect, it } from 'vitest';
import { loadLive, RateLimitedError, readLiveConfig, type Fetch } from '../../../web/src/lib/liveFetch.js';
import { mergeFacts, mergeLoops } from '../../../web/src/lib/liveMerge.js';
import type { HealthCheck, LoopDetail, LoopSummary } from '../../../src/core/types.js';

const json = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), { ...init, headers: { 'content-type': 'application/json', ...init.headers } });
const commit = { sha: 'a'.repeat(40), commit: { message: 'web: unit\n\nLane: web', committer: { date: '2026-10-11T06:00:00Z' } } };
const NOW = new Date('2026-10-11T07:00:00Z');

function fakeGitHub(overrides: Record<string, () => Response> = {}): { fetch: Fetch; urls: string[] } {
  const urls: string[] = [];
  const fetchFn: Fetch = async (url) => {
    urls.push(url);
    const hit = Object.entries(overrides).find(([k]) => url.includes(k));
    if (hit) return hit[1]();
    if (url.includes('/git/trees/')) return json({ tree: [{ path: '.ai/lanes.json' }, { path: '.ai/task.md' }] });
    if (url.includes('/commits')) return json([commit]);
    if (url.includes('/actions/runs')) return json({ workflow_runs: [] });
    if (url.endsWith('.ai/lanes.json')) return new Response('{"lanes":[{"name":"web","owns":["web/**"],"cron":"0 * * * *"}]}');
    if (url.endsWith('.ai/task.md')) return new Response('# Task\nRun: 3 / 20\n');
    return new Response('', { status: 404 });
  };
  return { fetch: fetchFn, urls };
}

describe('readLiveConfig', () => {
  it('accepts a repo slug and an optional loop id', async () => {
    const f: Fetch = async () => json({ repo: 'a/b', loop: 'me' });
    expect(await readLiveConfig(f)).toEqual({ repo: 'a/b', loop: 'me' });
  });
  it.each([[json({ repo: '../x' })], [json({ nope: 1 })], [new Response('<html>', { headers: { 'content-type': 'text/html' } })], [new Response('', { status: 404 })]])('is undefined for %#', async (res) => {
    expect(await readLiveConfig(async () => res.clone())).toBeUndefined();
  });
  it('is undefined when the request throws', async () => {
    expect(await readLiveConfig(async () => { throw new Error('offline'); })).toBeUndefined();
  });
});

describe('loadLive', () => {
  it('fetches lane files after lanes.json and builds the loop', async () => {
    const gh = fakeGitHub();
    const live = await loadLive(gh.fetch, { repo: 'a/b', loop: 'me' }, NOW);
    expect(live.detail.id).toBe('me');
    expect(live.detail.lanes?.map((l) => l.name)).toEqual(['web']);
    expect(live.detail.run).toBe(3);
    // Only files the tree lists are requested.
    expect(gh.urls.filter((u) => u.includes('raw.githubusercontent')).map((u) => u.split('/main/')[1])).toEqual(['.ai/task.md', '.ai/lanes.json']);
  });
  it('probes every file when the tree listing fails', async () => {
    const gh = fakeGitHub({ '/git/trees/': () => new Response('x', { status: 500 }) });
    await loadLive(gh.fetch, { repo: 'a/b' }, NOW);
    expect(gh.urls.some((u) => u.endsWith('/DONE.md'))).toBe(true);
  });
  it('turns 403 into RateLimitedError with the reset time', async () => {
    const gh = fakeGitHub({ '/commits': () => new Response('{}', { status: 403, headers: { 'x-ratelimit-reset': '1790000000' } }) });
    await expect(loadLive(gh.fetch, { repo: 'a/b' }, NOW)).rejects.toMatchObject({ resetAt: 1_790_000_000_000 });
    await expect(loadLive(gh.fetch, { repo: 'a/b' }, NOW)).rejects.toBeInstanceOf(RateLimitedError);
  });
  it('survives a failing runs request but not a failing commits request', async () => {
    const noRuns = fakeGitHub({ '/actions/runs': () => new Response('x', { status: 500 }) });
    expect((await loadLive(noRuns.fetch, { repo: 'a/b' }, NOW)).checks.some((c) => c.kind === 'failing-tests')).toBe(false);
    const noCommits = fakeGitHub({ '/commits': () => new Response('x', { status: 500 }) });
    await expect(loadLive(noCommits.fetch, { repo: 'a/b' }, NOW)).rejects.toThrow('500');
  });
});

describe('merge', () => {
  const sum = (id: string): LoopSummary => ({ id, name: id, state: 'done', reason: '', round: 1, roundsTotal: 1, run: 0, runLimit: 0 });
  it('replaces the live id and puts it first', () => {
    const live = { ...sum('b'), timeline: [], contract: [], knowledge: [], decisions: [], history: [] } as LoopDetail;
    expect(mergeLoops([sum('a'), sum('b')], live).map((l) => l.id)).toEqual(['b', 'a']);
    expect(mergeLoops([sum('a')], undefined).map((l) => l.id)).toEqual(['a']);
  });
  it('mergeFacts keeps other loops rows', () => {
    const c = (loopId: string): HealthCheck => ({ loopId, kind: 'failing-tests', ok: true, reason: '', proof: '' });
    expect(mergeFacts([c('a'), c('b')], 'b', [c('b')]).map((x) => x.loopId)).toEqual(['b', 'a']);
    expect(mergeFacts([c('a')], undefined, [])).toHaveLength(1);
  });
});
