import { describe, expect, it } from 'vitest';
import { indicatorText, LIVE_TTL_MS, readCache, writeCache, type KeyValueStore } from '../../../web/src/lib/liveCache.js';

const memory = (): KeyValueStore & { map: Map<string, string> } => {
  const map = new Map<string, string>();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
};

describe('live cache', () => {
  it('returns an entry younger than 5 minutes and drops an older one', () => {
    const store = memory();
    writeCache(store, 'k', { a: 1 }, 1_000);
    expect(readCache(store, 'k', 1_000 + LIVE_TTL_MS - 1)?.data).toEqual({ a: 1 });
    expect(readCache(store, 'k', 1_000 + LIVE_TTL_MS)).toBeUndefined();
  });
  it('treats corrupt, future-dated or missing entries as a miss', () => {
    const store = memory();
    store.setItem('bad', '{not json');
    store.setItem('future', JSON.stringify({ at: 5_000, data: 1 }));
    expect(readCache(store, 'bad', 1)).toBeUndefined();
    expect(readCache(store, 'future', 1_000)).toBeUndefined();
    expect(readCache(store, 'none', 1)).toBeUndefined();
  });
  it('survives storage that throws', () => {
    const blocked: KeyValueStore = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(() => writeCache(blocked, 'k', 1, 0)).not.toThrow();
    expect(readCache(blocked, 'k', 0)).toBeUndefined();
  });
});

describe('indicatorText', () => {
  const at = Date.UTC(2026, 9, 11, 14, 5);
  it('says Live with the UTC time, and goes stale after two refresh periods', () => {
    expect(indicatorText({ kind: 'live', updatedAt: at }, at)).toEqual({ label: 'Live · updated 14:05 UTC', tone: 'live' });
    expect(indicatorText({ kind: 'live', updatedAt: at }, at + 2 * LIVE_TTL_MS).tone).toBe('stale');
  });
  it('words the snapshot calmly, with the reset time when rate-limited', () => {
    expect(indicatorText({ kind: 'snapshot', date: '6 Oct' }, at)).toEqual({ label: 'Snapshot from 6 Oct', tone: 'calm' });
    expect(indicatorText({ kind: 'rate-limited', date: '6 Oct', resetAt: at }, at).label).toContain('resumes about 14:05 UTC');
  });
});
