import type { LiveLoop } from '../../../src/server/live/index.js';
import { LIVE_TTL_MS, readCache, writeCache, type LiveState } from '../lib/liveCache';
import { loadLive, RateLimitedError, readLiveConfig, type LiveConfig } from '../lib/liveFetch';

const CACHE_KEY = 'live-loop-v1';
const listeners = new Set<() => void>();
let state: LiveState | undefined;
let current: LiveLoop | undefined;
let inflight: Promise<LiveLoop | undefined> | undefined;
let configPromise: Promise<LiveConfig | undefined> | undefined;

function set(next: LiveState | undefined, loop?: LiveLoop) {
  state = next;
  if (loop) current = loop;
  listeners.forEach((l) => l());
}

export const liveStore = {
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  get: () => state,
};

function session(): Storage | undefined {
  try { return window.sessionStorage; } catch { return undefined; }
}

/** The live GitHub view of the self-build loop, or undefined (no live.json, offline, rate-limited): callers show the snapshot. */
export function getLive(snapshotDate: string, force = false): Promise<LiveLoop | undefined> {
  const store = session();
  const now = Date.now();
  if (!force && current && state?.kind === 'live' && now - state.updatedAt < LIVE_TTL_MS) return Promise.resolve(current);
  const cached = !force && store ? readCache<LiveLoop>(store, CACHE_KEY, now) : undefined;
  if (cached) { set({ kind: 'live', updatedAt: cached.at }, cached.data); return Promise.resolve(cached.data); }
  inflight ??= (async () => {
    configPromise ??= readLiveConfig((u, i) => fetch(u, i));
    const config = await configPromise;
    if (!config) return undefined; // static hosting without live.json: plain snapshot, no chip change
    try {
      const loop = await loadLive((u, i) => fetch(u, i), config, new Date());
      if (store) writeCache(store, CACHE_KEY, loop, Date.now());
      set({ kind: 'live', updatedAt: Date.now() }, loop);
      return loop;
    } catch (e) {
      set(e instanceof RateLimitedError
        ? { kind: 'rate-limited', date: snapshotDate, ...(e.resetAt && { resetAt: e.resetAt }) }
        : { kind: 'snapshot', date: snapshotDate });
      return undefined;
    } finally { inflight = undefined; }
  })();
  return inflight;
}
