import { describe, expect, it } from 'vitest';
import { loadLive, RateLimitedError, readLiveConfig, type Fetch } from '../../../web/src/lib/liveFetch.js';
import { mergeFacts, mergeLoops, pagesUrl } from '../../../web/src/lib/liveMerge.js';
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

describe('loadLive history (round 4 A1)', () => {
  const snap = (n: number) => ({ sha: `a${String(n).padStart(6, '0')}`, at: new Date(Date.UTC(2026, 9, 6, 0, n)).toISOString(), message: `old ${n}` });
  const raw = (n: number) => ({ sha: `e${String(n).padStart(6, '0')}${'0'.repeat(33)}`, commit: { message: `web: new ${n}`, committer: { date: new Date(Date.UTC(2026, 9, 11, 0, n % 60, n)).toISOString() } } });

  it('fetches commits since the snapshot, every page, and merges them with the snapshot history', async () => {
    const snapshot = Array.from({ length: 109 }, (_, i) => snap(i));
    const pages: string[] = [];
    const gh = fakeGitHub({ '/commits': () => json([]) });
    const fetchFn: Fetch = async (url, init) => {
      if (!url.includes('/commits')) return gh.fetch(url, init);
      pages.push(url);
      const page = Number(new URL(url).searchParams.get('page'));
      return json(page === 1 ? Array.from({ length: 100 }, (_, i) => raw(i)) : [raw(100), raw(101)]);
    };
    const live = await loadLive(fetchFn, { repo: 'a/b', loop: 'me' }, NOW, snapshot);
    expect(pages).toHaveLength(2);
    expect(pages[0]).toContain('since=2026-10-06T');
    expect(live.detail.timeline).toHaveLength(109 + 102);
    expect(new Set(live.detail.timeline.map((c) => c.sha)).size).toBe(211);
  });

  it('keeps the old single-call fetch when there is no snapshot', async () => {
    const gh = fakeGitHub();
    await loadLive(gh.fetch, { repo: 'a/b' }, NOW);
    expect(gh.urls.filter((u) => u.includes('/commits'))).toHaveLength(1);
    expect(gh.urls.find((u) => u.includes('/commits'))).not.toContain('since=');
  });

  it('a rate limit while paging rejects, so the caller shows the snapshot alone', async () => {
    const gh = fakeGitHub({ '/commits': () => new Response('{}', { status: 403 }) });
    await expect(loadLive(gh.fetch, { repo: 'a/b' }, NOW, [snap(1)])).rejects.toBeInstanceOf(RateLimitedError);
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
  it('adds CI and the Pages demo to the live card', () => {
    const live = { ...sum('b'), url: 'https://github.com/Owner/b', timeline: [], contract: [], knowledge: [], decisions: [], history: [] } as LoopDetail;
    const check: HealthCheck = { loopId: 'b', kind: 'failing-tests', ok: false, reason: 'x', proof: '' };
    const [card] = mergeLoops([], live, [check]);
    expect(card?.ci).toEqual({ ok: false, reason: 'x' });
    expect(card?.demoUrl).toBe('https://owner.github.io/b/');
    expect(pagesUrl('https://example.com/a/b')).toBeUndefined();
    expect(pagesUrl(undefined)).toBeUndefined();
  });
  it('mergeFacts keeps other loops rows', () => {
    const c = (loopId: string): HealthCheck => ({ loopId, kind: 'failing-tests', ok: true, reason: '', proof: '' });
    expect(mergeFacts([c('a'), c('b')], 'b', [c('b')]).map((x) => x.loopId)).toEqual(['b', 'a']);
    expect(mergeFacts([c('a')], undefined, [])).toHaveLength(1);
  });
});
