import { describe, expect, it } from 'vitest';
import { policyNote } from '../../../src/server/paceNote.js';

describe('policyNote', () => {
  it('returns the trimmed reason string', () => {
    expect(policyNote('{"version":1,"pace":"fast","reason":"  CI red twice  "}')).toBe('CI red twice');
  });

  it('ignores a missing file, bad JSON, non-strings and blanks', () => {
    for (const text of [undefined, 'nope', 'null', '{"reason":3}', '{"reason":"  "}', '{}']) expect(policyNote(text)).toBeUndefined();
  });

  it('caps a long reason', () => {
    expect(policyNote(JSON.stringify({ reason: 'x'.repeat(500) }))).toHaveLength(300);
  });
});
