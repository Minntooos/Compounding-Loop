import { describe, expect, it } from 'vitest';
import { lanePace, lanePaceText, paceFileText, paceToast, policyOf } from '../../../web/src/lib/pace.js';
import { parsePolicy } from '../../../src/core/parse/policy.js';

const PACE = { pace: 'balanced' as const, overrides: { web: 'careful' as const, core: 'balanced' as const } };

describe('lanePace', () => {
  it('returns the lane override, else the loop pace', () => {
    expect(lanePace(PACE, 'web')).toEqual({ pace: 'careful', own: true });
    expect(lanePace(PACE, 'docs')).toEqual({ pace: 'balanced', own: false });
  });
});

describe('lanePaceText', () => {
  it('speaks only when the lane runs at a pace of its own that differs from the loop', () => {
    expect(lanePaceText(PACE, 'web')).toBe('Pace: careful (own)');
    expect(lanePaceText(PACE, 'core')).toBeUndefined();
    expect(lanePaceText(PACE, 'docs')).toBeUndefined();
  });
});

describe('policyOf / paceFileText', () => {
  it('rebuilds policy.json and sets the loop or one lane, keeping the other overrides', () => {
    expect(policyOf(PACE)).toEqual({ version: 1, pace: 'balanced', lanes: { web: { pace: 'careful' }, core: { pace: 'balanced' } } });
    expect(parsePolicy(paceFileText(PACE, 'fast'))).toEqual({ version: 1, pace: 'fast', lanes: { web: { pace: 'careful' }, core: { pace: 'balanced' } } });
    const lane = parsePolicy(paceFileText(PACE, 'sprint', 'docs'));
    expect(lane.pace).toBe('balanced');
    expect(lane.lanes).toEqual({ web: { pace: 'careful' }, core: { pace: 'balanced' }, docs: { pace: 'sprint' } });
    expect(paceFileText(PACE, 'fast').endsWith('\n')).toBe(true);
  });
});

describe('paceToast', () => {
  it('says who changed, from when, and when nothing needed changing', () => {
    expect(paceToast('fast', undefined, true, 'balanced')).toBe("Loop pace is now fast, from each lane's next run (lanes with their own pace keep it)");
    expect(paceToast('careful', 'web', true, 'balanced')).toBe('web now runs at careful from its next run');
    expect(paceToast('balanced', 'web', true, 'balanced')).toBe('web now runs at balanced (same as the loop) from its next run');
    expect(paceToast('careful', 'web', false, 'balanced')).toBe('web already runs at careful');
    expect(paceToast('fast', undefined, false, 'fast')).toBe('Loop pace is already fast');
  });
});
