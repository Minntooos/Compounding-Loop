import { describe, expect, it } from 'vitest';
import { newestActivity, shortDateUtc } from '../../../web/src/lib/format.js';

describe('format helpers', () => {
  it('shortDateUtc is absolute and UTC', () => {
    expect(shortDateUtc('2026-10-06T23:59:00Z')).toBe('6 Oct');
  });
  it('newestActivity picks the latest commit time, else the fallback', () => {
    const loops = [{ lastCommit: { at: '2026-10-08T10:00:00Z' } }, {}, { lastCommit: { at: '2026-10-10T09:00:00Z' } }];
    expect(newestActivity(loops, '2026-10-06T00:00:00Z')).toBe('2026-10-10T09:00:00Z');
    expect(newestActivity([], '2026-10-06T00:00:00Z')).toBe('2026-10-06T00:00:00Z');
  });
});
