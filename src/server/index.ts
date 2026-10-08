import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { projectsSource } from './loops.js';
import { loadDemoSnapshot, snapshotSource, type DataSource } from './data.js';

export interface AppOptions {
  /** Serve the bundled demo snapshot and refuse writes. */
  demo: boolean;
  /** Folder whose subfolders are loop clones (used when `demo` is false). */
  projectsDir?: string;
  /** Overrides the data source; tests use this. */
  source?: DataSource;
}

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string };

/** Builds the HTTP app without opening a port, so tests can call `app.request()`. */
export async function createApp(options: AppOptions): Promise<Hono> {
  const source = options.source ?? (options.demo ? snapshotSource(await loadDemoSnapshot()) : projectsSource(options.projectsDir ?? process.cwd()));
  const app = new Hono();

  app.get('/api/health', (c) => c.json({ ok: true, version: pkg.version, demo: options.demo }));
  app.get('/api/loops', async (c) => c.json(await source.loops()));
  app.get('/api/loops/:id', async (c) => {
    const loop = await source.loop(c.req.param('id'));
    return loop ? c.json(loop) : c.json({ error: 'no such loop' }, 404);
  });
  app.get('/api/inbox', async (c) => c.json(await source.inbox()));
  app.get('/api/checks', async (c) => c.json(await source.checks()));
  app.notFound((c) => c.json({ error: 'not found' }, 404));
  return app;
}

export interface StartOptions extends AppOptions {
  port: number;
}

/** Listens on 127.0.0.1 only; `url` carries the port actually bound (port 0 picks a free one). */
export async function startServer(options: StartOptions): Promise<{ url: string; close: () => Promise<void> }> {
  const app = await createApp(options);
  const server = await new Promise<ReturnType<typeof serve>>((resolve, reject) => {
    const s = serve({ fetch: app.fetch, port: options.port, hostname: '127.0.0.1' }, () => resolve(s));
    s.once('error', reject);
  });
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))),
  };
}
