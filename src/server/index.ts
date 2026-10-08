import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { DEFAULT_WATCH, EventBus, watchProjects, type WatchOptions } from './events.js';
import { projectsSource } from './loops.js';
import { SECURITY_HEADERS, staticHandler } from './static.js';
import { loadDemoSnapshot, snapshotSource, type DataSource } from './data.js';

export interface AppOptions {
  /** Serve the bundled demo snapshot and refuse writes. */
  demo: boolean;
  /** Folder whose subfolders are loop clones (used when `demo` is false). */
  projectsDir?: string;
  /** Overrides the data source; tests use this. */
  source?: DataSource;
  /** Where `/api/events` gets its events; `startServer` feeds it from the watcher. */
  bus?: EventBus;
  /** Folder with the built dashboard; defaults to `dist/web` next to the compiled server. */
  webDir?: string;
}

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string };

const LOOPBACK_HOST = /^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/i;

/** True for a Host header or Origin URL that names this machine. */
export function isLoopbackHost(host: string | undefined): boolean {
  return host !== undefined && LOOPBACK_HOST.test(host);
}

/** True when an Origin header is absent (not a browser cross-site call) or is a loopback page. */
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (origin === undefined) return true;
  try {
    return isLoopbackHost(new URL(origin).host);
  } catch {
    return false;
  }
}

/** `dist/web` from compiled code (`dist/server`) or from source (`src/server`). */
export function defaultWebDir(): string {
  const candidates = [new URL('../web/', import.meta.url), new URL('../../dist/web/', import.meta.url)].map((u) => fileURLToPath(u));
  return candidates.find((dir) => existsSync(dir)) ?? (candidates[0] as string);
}

/** Builds the HTTP app without opening a port, so tests can call `app.request()`. */
export async function createApp(options: AppOptions): Promise<Hono> {
  const source = options.source ?? (options.demo ? snapshotSource(await loadDemoSnapshot()) : projectsSource(options.projectsDir ?? process.cwd()));
  const bus = options.bus ?? new EventBus();
  const app = new Hono();

  app.use('*', async (c, next) => {
    await next();
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) c.res.headers.set(name, value);
  });

  // Defence against DNS rebinding and cross-site requests: this server only answers its own pages.
  app.use('*', async (c, next) => {
    if (!isLoopbackHost(c.req.header('host') ?? new URL(c.req.url).host) || !isAllowedOrigin(c.req.header('origin'))) {
      return c.json({ error: 'forbidden' }, 403);
    }
    // JSON bodies force a CORS preflight, which this server never grants.
    if (c.req.method === 'POST' && !(c.req.header('content-type') ?? '').toLowerCase().startsWith('application/json')) {
      return c.json({ error: 'content-type must be application/json' }, 415);
    }
    await next();
  });

  app.get('/api/health', (c) => c.json({ ok: true, version: pkg.version, demo: options.demo }));
  app.get('/api/loops', async (c) => c.json(await source.loops()));
  app.get('/api/loops/:id', async (c) => {
    const loop = await source.loop(c.req.param('id'));
    return loop ? c.json(loop) : c.json({ error: 'no such loop' }, 404);
  });
  app.post('/api/loops/:id/answer', async (c) => {
    if (!source.answer) return c.json({ error: 'demo is read-only' }, 409);
    const body: unknown = await c.req.json().catch(() => undefined);
    const { file, answer } = (body ?? {}) as { file?: unknown; answer?: unknown };
    if (typeof answer !== 'string' || answer.trim() === '') return c.json({ error: 'answer must be a non-empty string' }, 400);
    // Only the BLOCKED.md at the clone root can be answered; the file name is never used to build a path.
    if (file !== 'BLOCKED.md') return c.json({ error: 'file must be "BLOCKED.md"' }, 400);
    try {
      const result = await source.answer(c.req.param('id'), answer);
      return result ? c.json({ ok: true, ...result }) : c.json({ error: 'no such loop' }, 404);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : String(error) }, 422);
    }
  });
  app.get('/api/inbox', async (c) => c.json(await source.inbox()));
  app.get('/api/checks', async (c) => c.json(await source.checks()));
  app.get('/api/events', (c) =>
    streamSSE(c, async (stream) => {
      const unsubscribe = bus.subscribe((event) => {
        const { type, ...data } = event;
        void stream.writeSSE({ event: type, data: JSON.stringify(data) }).catch(() => undefined);
      });
      let wake: () => void = () => undefined;
      let timer: NodeJS.Timeout | undefined;
      stream.onAbort(() => wake());
      await stream.writeSSE({ event: 'ready', data: '{}' });
      // A comment line every 25 s keeps proxies and browsers from dropping an idle connection.
      while (!stream.aborted) {
        await new Promise<void>((resolve) => {
          wake = resolve;
          timer = setTimeout(resolve, 25_000);
        });
        clearTimeout(timer);
        if (!stream.aborted) await stream.write(': keep-alive\n\n');
      }
      unsubscribe();
    }),
  );
  app.all('/api/*', (c) => c.json({ error: 'not found' }, 404));
  const serveWeb = staticHandler(options.webDir ?? defaultWebDir());
  app.get('*', (c) => serveWeb(c));
  app.notFound((c) => c.json({ error: 'not found' }, 404));
  return app;
}

export interface StartOptions extends AppOptions {
  port: number;
  /** Watcher timing; tests pass a short interval and `fetchIntervalMs: 0`. */
  watch?: Partial<WatchOptions>;
}

/** Listens on 127.0.0.1 only; `url` carries the port actually bound (port 0 picks a free one). */
export async function startServer(options: StartOptions): Promise<{ url: string; close: () => Promise<void> }> {
  const bus = options.bus ?? new EventBus();
  const app = await createApp({ ...options, bus });
  const stopWatching = options.demo ? undefined : watchProjects(options.projectsDir ?? process.cwd(), bus, { ...DEFAULT_WATCH, ...options.watch });
  const server = await new Promise<ReturnType<typeof serve>>((resolve, reject) => {
    const s = serve({ fetch: app.fetch, port: options.port, hostname: '127.0.0.1' }, () => resolve(s));
    s.once('error', reject);
  });
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve, reject) => {
        stopWatching?.();
        server.close((e) => (e ? reject(e) : resolve()));
        // Open SSE connections would keep close() waiting forever.
        if ('closeAllConnections' in server) server.closeAllConnections();
      }),
  };
}
