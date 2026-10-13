import { describe, expect, it } from 'vitest';
import { releaseChips } from '../../../web/src/lib/releases.js';

describe('releaseChips (round 5 C7)', () => {
  it('names the tag and the npm state in words', () => {
    expect(releaseChips({ tag: true, npm: 'latest' }).map((c) => c.label)).toEqual(['Tagged', 'npm latest']);
    expect(releaseChips({ tag: false, npm: 'not-published' }).map((c) => c.label)).toEqual(['No tag', 'Not on npm']);
    expect(releaseChips({ npm: 'published' }).map((c) => c.label)).toEqual(['On npm']);
    expect(releaseChips({ npm: 'unknown' })).toEqual([{ label: 'npm not checked', tone: 'unknown' }]);
  });
  it('adds nothing for fields that were not checked', () => {
    expect(releaseChips({})).toEqual([]);
  });
});
