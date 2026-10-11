import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DemoSnapshot } from '../../../src/core/types.js';
import { createApp, startServer } from '../../../src/server/index.js';
import { CSP, mimeFor, resolveInside } from '../../../src/server/static.js';
import { LIVE_CONNECT_HOSTS, SELF_LIVE_CONFIG, STATIC_CSP, staticApiFiles, staticIndexHtml, writeStaticApi } from '../../../src/server/static-export.js';
import { loadDemoSnapshot } from '../../../src/server/data.js';

let root: string;
let web: string;
beforeAll(() => {
  // A private parent folder, so the secret next to `web` never lands in (or collides inside) the shared temp root.
  root = mkdtempSync(path.join(tmpdir(), 'cl-static-'));
  web = path.join(root, 'web');
  mkdirSync(path.join(web, 'assets'), { recursive: true });
  writeFileSync(path.join(web, 'index.html'), '<!doctype html><title>x</title>');
  writeFileSync(path.join(web, 'assets', 'app-abc.js'), 'console.log(1)');
  writeFileSync(path.join(root, 'secret.txt'), 'top secret');
});
afterAll(() => {
  rmSync(root, { recursive: true, force: true, maxRetries: 5 });
});

describe('resolveInside', () => {
  it('maps normal paths and refuses traversal in every spelling', () => {
    expect(resolveInside('/srv/web', '/assets/a.js')).toBe(path.resolve('/srv/web/assets/a.js'));
    for (const bad of ['/../secret', '/a/../../secret', '/%2e%2e/secret', '/..%2Fsecret', '/a\\..\\secret', '/x%00', '/%E0%A4%A']) {
      expect(resolveInside('/srv/web', bad), bad).toBeUndefined();
    }
  });
});

describe('mimeFor', () => {
  it('knows the dashboard file types and defaults to octet-stream', () => {
    expect(mimeFor('a.js')).toContain('javascript');
    expect(mimeFor('a.woff2')).toBe('font/woff2');
    expect(mimeFor('a.unknown')).toBe('application/octet-stream');
  });
});

describe('serving the dashboard', async () => {
  const app = await createApp({ demo: true, webDir: undefined });
  const served = async () => createApp({ demo: true, webDir: web });

  it('serves index.html at / and falls back to it for client routes', async () => {
    const a = await served();
    for (const url of ['/', '/inbox', '/loop/proj1']) {
      const res = await a.request(url);
      expect(res.status, url).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
      expect(res.headers.get('cache-control')).toBe('no-cache');
    }
  });

  it('serves hashed assets as immutable and 404s a missing asset', async () => {
    const a = await served();
    const res = await a.request('/assets/app-abc.js');
    expect(res.headers.get('content-type')).toContain('javascript');
    expect(res.headers.get('cache-control')).toContain('immutable');
    expect((await a.request('/assets/missing.js')).status).toBe(404);
  });

  it('never serves files outside the web folder', async () => {
    const a = await served();
    for (const url of ['/..%2Fsecret.txt', '/%2e%2e/secret.txt']) {
      const res = await a.request(url);
      expect(res.status, url).toBe(404);
      expect(await res.text()).not.toContain('top secret');
    }
  });

  it('sets a strict CSP and friends on files and API responses alike', async () => {
    const a = await served();
    for (const url of ['/', '/api/health', '/api/nope']) {
      const res = await a.request(url);
      expect(res.headers.get('content-security-policy'), url).toBe(CSP);
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    }
    expect(CSP).toContain("default-src 'none'");
    expect(CSP).not.toMatch(/unsafe-eval|https?:|\*/);
    expect(CSP).toContain("script-src 'self'");
    expect(CSP).toContain("font-src 'self' data:");
  });

  it('says so when the dashboard is not built, and unknown /api paths stay JSON', async () => {
    const res = await (await createApp({ demo: true, webDir: path.join(web, 'nope') })).request('/');
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('npm run build');
    expect((await app.request('/api/zzz')).headers.get('content-type')).toContain('json');
  });

  it('serves over a real port too', async () => {
    const server = await startServer({ demo: true, port: 0, webDir: web });
    try {
      const res = await fetch(`${server.url}/`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-security-policy')).toBe(CSP);
    } finally {
      await server.close();
    }
  });
});

describe('static CSP and live config', () => {
  it('allows exactly the two GitHub hosts in connect-src and nothing else extra', () => {
    const connect = STATIC_CSP.split('; ').find((d) => d.startsWith('connect-src'));
    expect(connect).toBe("connect-src 'self' https://api.github.com https://raw.githubusercontent.com");
    expect([...(STATIC_CSP.match(/https?:\/\/[^\s;]+/g) ?? [])].sort()).toEqual([...LIVE_CONNECT_HOSTS].sort());
    expect(STATIC_CSP.replace(connect ?? '', '')).toBe(CSP.replace("connect-src 'self'", ''));
    expect(STATIC_CSP).not.toMatch(/unsafe-eval|\*/);
  });
  it('leaves the local server CSP closed to the network', () => {
    expect(CSP).toContain("connect-src 'self';");
    expect(CSP).not.toMatch(/github/);
  });
  it('writes live.json for the self loop', () => {
    expect(SELF_LIVE_CONFIG).toEqual({ repo: 'Minntooos/Compounding-Loop', loop: 'compounding-loop', pages: 'https://minntooos.github.io/Compounding-Loop/' });
    expect(staticApiFiles({ generatedAt: 'x', loops: [], inbox: [], checks: [] }, '1').get('live.json')).toEqual(SELF_LIVE_CONFIG);
  });
  it('puts the CSP meta tag first in <head>, without frame-ancestors', () => {
    const out = staticIndexHtml('<!doctype html><html><head><meta charset="utf-8"><title>x</title></head><body></body></html>');
    expect(out).toMatch(/<head>\s*<meta http-equiv="Content-Security-Policy" content="default-src 'none'; [^"]*api\.github\.com[^"]*"><meta charset/);
    expect(out).not.toContain('frame-ancestors');
    expect(() => staticIndexHtml('<html></html>')).toThrow(/head/);
  });
});

describe('static demo export', () => {
  const snapshot = { generatedAt: 'x', loops: [{ id: 'a', name: 'a', state: 'done', reason: '', round: 1, roundsTotal: 1, run: 0, runLimit: 1, timeline: [], contract: [], knowledge: [], decisions: [], history: [] }], inbox: [], checks: [] } as DemoSnapshot;

  it('lists one file per API read route', () => {
    const files = staticApiFiles(snapshot, '1.2.3');
    expect([...files.keys()].sort()).toEqual(['api/checks.json', 'api/health.json', 'api/inbox.json', 'api/loops.json', 'api/loops/a.json', 'api/settings.json', 'live.json']);
    expect(files.get('api/health.json')).toEqual({ ok: true, version: '1.2.3', demo: true });
    expect(files.get('api/settings.json')).toEqual({ demo: true, defaultRunner: 'routine' });
    expect(files.get('api/loops.json')).toEqual([expect.not.objectContaining({ timeline: expect.anything() })]);
  });

  it('writes the files to disk matching what the live demo API returns', async () => {
    const out = mkdtempSync(path.join(tmpdir(), 'cl-static-'));
    try {
      const real = await loadDemoSnapshot();
      const written = await writeStaticApi(out, real, 'v');
      expect(written).toContain('api/loops/proj1.json');
      const live = await (await createApp({ demo: true })).request('/api/loops');
      const { readFile } = await import('node:fs/promises');
      expect(JSON.parse(await readFile(path.join(out, 'api', 'loops.json'), 'utf8'))).toEqual(await live.json());
    } finally {
      rmSync(out, { recursive: true, force: true, maxRetries: 5 });
    }
  });
});
