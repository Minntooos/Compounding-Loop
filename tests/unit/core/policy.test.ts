import { describe, expect, it } from 'vitest';
import { PACES, PACE_SUMMARY, emptyPolicy, formatPolicy, isPace, paceFor, parsePolicy, withPace } from '../../../src/core/parse/policy.js';

describe('policy', () => {
  it('reads the global pace and lane overrides', () => {
    const p = parsePolicy('{"version":1,"pace":"fast","lanes":{"web":{"pace":"careful"}}}');
    expect(p).toEqual({ version: 1, pace: 'fast', lanes: { web: { pace: 'careful' } } });
    expect(paceFor(p, 'web')).toBe('careful');
    expect(paceFor(p, 'core')).toBe('fast');
    expect(paceFor(p)).toBe('fast');
  });

  it('falls back to balanced on anything unreadable and drops unknown presets', () => {
    for (const text of ['', 'nope', '[]', 'null', '{"pace":"warp"}']) expect(parsePolicy(text)).toEqual(emptyPolicy());
    expect(parsePolicy('{"pace":"sprint","lanes":{"a":{"pace":"warp"},"b":"x","c":{"pace":"fast"}}}').lanes).toEqual({ c: { pace: 'fast' } });
    expect(parsePolicy('{"pace":"sprint","lanes":[]}').pace).toBe('sprint');
  });

  it('ignores a __proto__ lane', () => {
    expect(Object.keys(parsePolicy('{"lanes":{"__proto__":{"pace":"fast"}}}').lanes)).toEqual([]);
  });

  it('round-trips through formatPolicy', () => {
    for (const p of [emptyPolicy(), withPace(withPace(emptyPolicy(), 'sprint'), 'careful', 'web')]) expect(parsePolicy(formatPolicy(p))).toEqual(p);
    expect(formatPolicy(emptyPolicy())).toBe('{\n  "version": 1,\n  "pace": "balanced",\n  "lanes": {}\n}\n');
  });

  it('withPace does not mutate and sets global or lane', () => {
    const base = emptyPolicy();
    expect(withPace(base, 'fast').pace).toBe('fast');
    expect(withPace(base, 'fast', 'core').lanes).toEqual({ core: { pace: 'fast' } });
    expect(base).toEqual(emptyPolicy());
  });

  it('has a summary for every preset and recognises only presets', () => {
    for (const pace of PACES) expect(PACE_SUMMARY[pace].length).toBeGreaterThan(10);
    expect(isPace('fast')).toBe(true);
    expect(isPace('warp')).toBe(false);
    expect(isPace(3)).toBe(false);
  });
});
