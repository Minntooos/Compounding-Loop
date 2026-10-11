/** Live data is cached per tab for 5 minutes and refreshed on that cadence while the tab is visible. */
export const LIVE_TTL_MS = 5 * 60_000;

export interface CacheEntry<T> { at: number; data: T }

/** Minimal slice of `Storage`, so tests need no browser. Every access is wrapped: storage can be blocked or full. */
export interface KeyValueStore { getItem(key: string): string | null; setItem(key: string, value: string): void }

export function readCache<T>(store: KeyValueStore, key: string, now: number, ttl = LIVE_TTL_MS): CacheEntry<T> | undefined {
  try {
    const raw = store.getItem(key);
    if (!raw) return undefined;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    return typeof entry.at === 'number' && now - entry.at >= 0 && now - entry.at < ttl ? entry : undefined;
  } catch { return undefined; }
}

export function writeCache<T>(store: KeyValueStore, key: string, data: T, now: number): void {
  try { store.setItem(key, JSON.stringify({ at: now, data } satisfies CacheEntry<T>)); } catch { /* storage blocked or full: just uncached */ }
}

export type LiveState =
  | { kind: 'live'; updatedAt: number }
  | { kind: 'snapshot'; date: string }
  | { kind: 'rate-limited'; date: string; resetAt?: number };

const hhmm = (ms: number) => new Date(ms).toISOString().slice(11, 16);

/** The header chip's wording (DESIGN.md "States"): live is stated plainly, the snapshot is calm, never an error. */
export function indicatorText(state: LiveState, now: number): { label: string; tone: 'live' | 'stale' | 'calm' } {
  if (state.kind === 'live') {
    const stale = now - state.updatedAt >= LIVE_TTL_MS * 2;
    return { label: `Live · updated ${hhmm(state.updatedAt)} UTC`, tone: stale ? 'stale' : 'live' };
  }
  if (state.kind === 'rate-limited') {
    const resume = state.resetAt ? `; live view resumes about ${hhmm(state.resetAt)} UTC` : '';
    return { label: `Snapshot from ${state.date} (GitHub's anonymous limit was reached${resume})`, tone: 'calm' };
  }
  return { label: `Snapshot from ${state.date}`, tone: 'calm' };
}
