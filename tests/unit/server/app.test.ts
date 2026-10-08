import { describe, expect, it } from 'vitest';
import type { LoopDetail, LoopSummary } from '../../../src/core/types.js';
import { sortByAttention, toSummary } from '../../../src/server/data.js';
import { createApp, startServer } from '../../../src/server/index.js';

describe('demo API', async () => {
  const app = await createApp({ demo: true });
  const get = async <T>(url: string) => (await app.request(url)).json() as Promise<T>;

  it('GET /api/health', async () => {
    expect(await get('/api/health')).toMatchObject({ ok: true, demo: true, version: expect.any(String) });
  });

  it('GET /api/loops lists the five sites without detail fields', async () => {
    const loops = await get<LoopSummary[]>('/api/loops');
    expect(loops).toHaveLength(5);
    expect(loops[0]).not.toHaveProperty('timeline');
    expect(loops[0]).toMatchObject({ state: 'done', roundsTotal: 5 });
  });

  it('GET /api/loops/:id returns the detail', async () => {
    const res = await app.request('/api/loops/proj1');
    expect(res.status).toBe(200);
    const detail = (await res.json()) as LoopDetail;
    expect(detail.timeline.length).toBeGreaterThan(0);
    expect(detail.contract.length).toBeGreaterThan(0);
  });

  it('404s an unknown loop and unknown routes with JSON', async () => {
    const res = await app.request('/api/loops/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no such loop' });
    expect((await app.request('/api/zzz')).status).toBe(404);
  });

  it('GET /api/inbox and /api/checks', async () => {
    expect(await get('/api/inbox')).toEqual([]);
    const checks = await get<unknown[]>('/api/checks');
    expect(checks.length).toBe(10);
  });
});

describe('sortByAttention / toSummary', () => {
  it('orders failing, blocked, building, waiting, done, then by name', () => {
    const rows = [
      { state: 'done', name: 'a' },
      { state: 'failing', name: 'z' },
      { state: 'building', name: 'b' },
      { state: 'blocked', name: 'c' },
      { state: 'waiting', name: 'd' },
      { state: 'building', name: 'a' },
    ] as const;
    expect(sortByAttention(rows).map((r) => `${r.state}:${r.name}`)).toEqual([
      'failing:z', 'blocked:c', 'building:a', 'building:b', 'waiting:d', 'done:a',
    ]);
  });

  it('toSummary drops the detail fields', () => {
    const detail = { id: 'x', name: 'x', state: 'done', reason: '', round: 1, roundsTotal: 1, run: 0, runLimit: 1, timeline: [], contract: [], knowledge: [], decisions: [], history: [] } as LoopDetail;
    expect(Object.keys(toSummary(detail)).sort()).toEqual(['id', 'name', 'reason', 'round', 'roundsTotal', 'run', 'runLimit', 'state']);
  });
});

describe('startServer', () => {
  it('binds a free port and serves /api/health', async () => {
    const server = await startServer({ demo: true, port: 0 });
    try {
      expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
      const res = await fetch(`${server.url}/api/health`);
      expect(await res.json()).toMatchObject({ ok: true });
    } finally {
      await server.close();
    }
  });
});

describe('loadDemoSnapshot', () => {
  it('falls back to the next candidate and fails clearly when none exist', async () => {
    const { loadDemoSnapshot } = await import('../../../src/server/data.js');
    const real = new URL('../../../demo/five-sites.json', import.meta.url);
    expect((await loadDemoSnapshot([new URL('file:///nope.json'), real])).loops).toHaveLength(5);
    await expect(loadDemoSnapshot([new URL('file:///nope.json')])).rejects.toThrow(/demo snapshot not found/);
  });
});

describe('host and origin guard', () => {
  it('refuses non-loopback Host and Origin on reads too', async () => {
    const app = await createApp({ demo: true });
    expect((await app.request('http://evil.example/api/health')).status).toBe(403);
    expect((await app.request('http://127.0.0.1:1/api/health', { headers: { origin: 'https://evil.example' } })).status).toBe(403);
    expect((await app.request('http://localhost:1/api/health', { headers: { origin: 'http://localhost:5173' } })).status).toBe(200);
  });
});
