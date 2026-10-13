import { describe, expect, it } from 'vitest';
import { checkLabel, checkState, checkSummary, checkText, codeParts, humanizeTimes, keepLastWords, reasonRepeats } from '../../../web/src/lib/health.js';

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

describe('checkState', () => {
  it('uses the server state and falls back to ok for checks without one', () => {
    expect(checkState({ ok: true, state: 'unchecked' })).toBe('unchecked');
    expect(checkState({ ok: true })).toBe('pass');
    expect(checkState({ ok: false })).toBe('fail');
  });
});

describe('checkText', () => {
  it('names what an unchecked check would measure and never states a result for it', () => {
    expect(checkText({ kind: 'failing-tests', ok: true, state: 'unchecked', label: 'Not checked' })).toBe('Test results');
    expect(checkText({ kind: 'failing-tests', ok: true, state: 'pass' })).toBe('Tests pass');
    expect(checkText({ kind: 'lane-stalled', ok: false, label: 'Lane web stalled' })).toBe('Lane web stalled');
  });
});

describe('checkSummary', () => {
  it('counts unchecked checks apart from passes and leaves empty groups out', () => {
    expect(checkSummary([{ ok: true }, { ok: true, state: 'unchecked' }, { ok: false }, { ok: true, state: 'pass' }])).toBe('1 failing · 2 passing · 1 not checked');
    expect(checkSummary([{ ok: true, state: 'unchecked' }])).toBe('1 not checked');
    expect(checkSummary([])).toBe('');
  });
});

describe('codeParts', () => {
  it('puts backtick spans at odd indexes and keeps text with an unpaired backtick whole', () => {
    expect(codeParts('Run `loop run` here')).toEqual(['Run ', 'loop run', ' here']);
    expect(codeParts('plain')).toEqual(['plain']);
    expect(codeParts('odd ` one')).toEqual(['odd ` one']);
  });
});

describe('reasonRepeats', () => {
  it('drops a reason that only restates the row', () => {
    expect(reasonRepeats('Tests pass', 'all tests pass')).toBe(true);
    expect(reasonRepeats('Runner is active', 'runner is active')).toBe(true);
  });
  it('keeps a reason that adds a fact', () => {
    expect(reasonRepeats('Tests failing', '3 tests fail')).toBe(false);
    expect(reasonRepeats('No stale session lock', 'no lock held')).toBe(false);
    expect(reasonRepeats('Runs last long enough', 'recent runs did real work')).toBe(false);
  });
  it('keeps an empty or filler-only reason out of the repeat rule', () => {
    expect(reasonRepeats('Tests pass', '')).toBe(false);
    expect(reasonRepeats('Tests pass', 'all')).toBe(false);
  });
});

describe('keepLastWords', () => {
  it('ties the last two words together and leaves one-word text alone', () => {
    expect(keepLastWords('GET https://a.app returned 200')).toBe('GET https://a.app returned\u00a0200');
    expect(keepLastWords('200')).toBe('200');
  });
});
