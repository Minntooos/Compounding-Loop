import { describe, expect, it } from 'vitest';
import { runLimitText, siteOf } from '../../../web/src/lib/settings.js';

const lane = (limit: number) => ({ limit }) as never;

describe('Settings text (round 4 A3)', () => {
  it('shows the per-lane limit for laned loops, not 0', () => {
    expect(runLimitText({ runLimit: 0, lanes: [lane(20), lane(20)] })).toBe('20 per lane');
    expect(runLimitText({ runLimit: 0, lanes: [lane(10), lane(20)] })).toBe('10-20 per lane');
    expect(runLimitText({ runLimit: 30 })).toBe('30');
  });
  it('shows the Pages site before the repo URL', () => {
    expect(siteOf({ url: 'https://github.com/a/b', demoUrl: 'https://a.github.io/b/' })).toBe('https://a.github.io/b/');
    expect(siteOf({ url: 'https://github.com/a/b' })).toBe('https://github.com/a/b');
  });
});
