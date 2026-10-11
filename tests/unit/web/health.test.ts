import { describe, expect, it } from 'vitest';
import { checkLabel, humanizeTimes } from '../../../web/src/lib/health.js';

describe('checkLabel', () => {
  it('states the result of the check, not only its name', () => {
    expect(checkLabel('failing-tests', true)).toBe('Tests pass');
    expect(checkLabel('failing-tests', false)).toBe('Tests failing');
    expect(checkLabel('leak', true)).not.toMatch(/^Leaked/);
    expect(checkLabel('mystery', true)).toBe('mystery');
  });
});

describe('humanizeTimes', () => {
  it('formats ISO times as "11 Oct 14:53 UTC" and leaves other text alone', () => {
    expect(humanizeTimes('CI at 2026-10-11T14:53:20Z ok')).toBe('CI at 11 Oct 14:53 UTC ok');
    expect(humanizeTimes('no times here, v2026-10')).toBe('no times here, v2026-10');
  });
});
