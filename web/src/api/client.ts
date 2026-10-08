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

async function getJson<T>(path: string, fallback: () => T): Promise<T> {
  if (!(await hasServer())) return fallback();
  const res = await fetchJson(path);
  if (!res?.ok) throw new Error(`GET /api${path} failed`);
  return (await res.json()) as T;
}

const ATTENTION = ['failing', 'blocked', 'building', 'waiting', 'done'] as const;

/** Fleet order from the contract: failing, blocked, building, waiting, done. */
export function sortByAttention(loops: LoopSummary[]): LoopSummary[] {
  return [...loops].sort((a, b) => ATTENTION.indexOf(a.state) - ATTENTION.indexOf(b.state) || a.name.localeCompare(b.name));
}

export const api = {
  loops: () => getJson<LoopSummary[]>('/loops', () => mockSnapshot.loops).then(sortByAttention),
  loop: (id: string) => getJson<LoopDetail | undefined>(`/loops/${encodeURIComponent(id)}`, () => mockSnapshot.loops.find((l) => l.id === id)),
  inbox: () => getJson<InboxItem[]>('/inbox', () => mockSnapshot.inbox),
  checks: () => getJson<HealthCheck[]>('/checks', () => mockSnapshot.checks),
};
