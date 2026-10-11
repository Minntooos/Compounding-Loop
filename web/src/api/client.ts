import type { DashboardSettings, HealthCheck, InboxItem, LoopDetail, LoopSummary } from '@core/types';
import { probeOrder } from '../lib/probe';
import { newestActivity, shortDateUtc } from '../lib/format';
import { mergeFacts, mergeLoops, pagesUrl } from '../lib/liveMerge';
import { getLive, setSnapshotLoader } from './live';
import { mockSnapshot } from './mock';

async function fetchJson(path: string): Promise<Response | undefined> {
  try {
    const res = await fetch(`/api${path}`, { headers: { accept: 'application/json' } });
    return (res.headers.get('content-type') ?? '').includes('json') ? res : undefined;
  } catch {
    return undefined;
  }
}

let serverProbe: Promise<boolean> | undefined;
/** True when a dashboard server answers /api/health with JSON. Without one (static export, preview) the demo snapshot is shown, labelled as sample data. */
export function hasServer(): Promise<boolean> {
  serverProbe ??= (async () => {
    for (const probe of probeOrder(window.location.hostname)) {
      if (probe === 'static') {
        // Relative to the page, so it also works under /Compounding-Loop/. A hit means static hosting: no server.
        const res = await fetch('api/health.json', { headers: { accept: 'application/json' } }).catch(() => undefined);
        if (res?.ok && (res.headers.get('content-type') ?? '').includes('json')) return false;
      } else if ((await fetchJson('/health'))?.ok === true) return true;
    }
    return false;
  })();
  return serverProbe;
}

/** Static hosting (GitHub Pages demo): relative `api/<route>.json` files exported by demo/export-static.mjs, else the bundled snapshot. */
async function staticJson<T>(path: string, fallback: () => T): Promise<T> {
  try {
    const res = await fetch(`api${path}.json`, { headers: { accept: 'application/json' } });
    if (res.ok && (res.headers.get('content-type') ?? '').includes('json')) return (await res.json()) as T;
  } catch { /* fall through to the bundled snapshot */ }
  return fallback();
}

async function getJson<T>(path: string, fallback: () => T, missing?: T): Promise<T> {
  if (!(await hasServer())) return staticJson(path, fallback);
  const res = await fetchJson(path);
  if (res?.status === 404 && missing !== undefined) return missing;
  if (!res?.ok) throw new Error(`GET /api${path} failed`);
  return (await res.json()) as T;
}

const ATTENTION = ['failing', 'blocked', 'building', 'waiting', 'done'] as const;

/** Fleet order from the contract: failing, blocked, building, waiting, done. */
export function sortByAttention(loops: LoopSummary[]): LoopSummary[] {
  return [...loops].sort((a, b) => ATTENTION.indexOf(a.state) - ATTENTION.indexOf(b.state) || a.name.localeCompare(b.name));
}

export interface AnswerResult { ok: true; commit: string; pushed: boolean }

/** POST an answer to a BLOCKED.md. Throws with the server's message (demo: "demo is read-only"). */
export async function postAnswer(loopId: string, file: string, answer: string): Promise<AnswerResult> {
  if (!(await hasServer())) throw new Error('Read-only demo: no dashboard server is running.');
  const res = await fetch(`/api/loops/${encodeURIComponent(loopId)}/answer`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ file, answer }),
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Answer failed (${res.status})`);
  return body as AnswerResult;
}

/** Static hosting only: the snapshot's rows, with the self-build loop replaced by its live GitHub state when that loads. */
async function withLive<T>(snapshot: T, merge: (rows: T, live: NonNullable<Awaited<ReturnType<typeof getLive>>>) => T): Promise<T> {
  if (await hasServer()) return snapshot;
  const loops = await staticJson<LoopSummary[]>('/loops', () => mockSnapshot.loops);
  const live = await getLive(shortDateUtc(newestActivity(loops, mockSnapshot.generatedAt)));
  return live ? merge(snapshot, live) : snapshot;
}

/** The live loop's Pages site, derived from its repo URL like the fleet card's. */
const withDemoUrl = (d: LoopDetail): LoopDetail => { const demoUrl = pagesUrl(d.url); return demoUrl ? { ...d, demoUrl } : d; };

setSnapshotLoader(async (id) => {
  const detail = await staticJson<LoopDetail | null>(`/loops/${encodeURIComponent(id)}`, () => mockSnapshot.loops.find((l) => l.id === id) ?? null);
  return detail?.timeline ?? [];
});

export const api = {
  loops: () => getJson<LoopSummary[]>('/loops', () => mockSnapshot.loops)
    .then((rows) => withLive(rows, (r, live) => mergeLoops(r, live.detail, live.checks))).then(sortByAttention),
  loop: (id: string) => getJson<LoopDetail | null>(`/loops/${encodeURIComponent(id)}`, () => mockSnapshot.loops.find((l) => l.id === id) ?? null, null)
    .then((row) => withLive(row, (r, live) => (live.detail.id === id ? withDemoUrl(live.detail) : r))),
  inbox: () => getJson<InboxItem[]>('/inbox', () => mockSnapshot.inbox)
    .then((rows) => withLive(rows, (r, live) => mergeFacts(r, live.detail.id, live.inbox))),
  checks: () => getJson<HealthCheck[]>('/checks', () => mockSnapshot.checks)
    .then((rows) => withLive(rows, (r, live) => mergeFacts(r, live.detail.id, live.checks))),
  settings: () => getJson<DashboardSettings>('/settings', (): DashboardSettings => ({ demo: true, defaultRunner: 'routine' })),
};
