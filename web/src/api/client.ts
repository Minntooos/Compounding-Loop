import type { HealthCheck, InboxItem, LoopDetail, LoopSummary } from '@core/types';
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
/** True when a dashboard server answers /api/health with JSON. Without one (static preview) the demo snapshot is shown, labelled as sample data. */
export function hasServer(): Promise<boolean> {
  serverProbe ??= fetchJson('/health').then((res) => res?.ok === true);
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

export const api = {
  loops: () => getJson<LoopSummary[]>('/loops', () => mockSnapshot.loops).then(sortByAttention),
  loop: (id: string) => getJson<LoopDetail | null>(`/loops/${encodeURIComponent(id)}`, () => mockSnapshot.loops.find((l) => l.id === id) ?? null, null),
  inbox: () => getJson<InboxItem[]>('/inbox', () => mockSnapshot.inbox),
  checks: () => getJson<HealthCheck[]>('/checks', () => mockSnapshot.checks),
};
