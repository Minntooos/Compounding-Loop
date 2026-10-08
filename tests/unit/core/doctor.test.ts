import { describe, expect, it } from 'vitest';
import { doctorPassed, evaluateDoctor, formatDoctor, parseNodeMajor, type DoctorInput } from '../../../src/core/doctor.js';

const ok = (output = 'x 1.0') => ({ ok: true, output });
const bad = { ok: false, output: 'spawn ENOENT' };
const healthy: DoctorInput = { nodeVersion: 'v22.1.0', git: ok('git version 2.45'), gh: ok('gh version 2.5'), ghAuth: ok(), claude: ok('2.1 (Claude Code)'), chromium: '/x/chromium-1200' };

describe('doctor', () => {
  it('parses node versions', () => {
    expect(parseNodeMajor('v20.11.1')).toBe(20);
    expect(parseNodeMajor('18.0.0')).toBe(18);
    expect(parseNodeMajor('weird')).toBe(0);
  });

  it('passes when everything is installed', () => {
    const checks = evaluateDoctor(healthy);
    expect(checks.every((c) => c.ok && c.fix === '')).toBe(true);
    expect(doctorPassed(checks)).toBe(true);
    expect(formatDoctor(checks)).toMatch(/Everything required is installed/);
  });

  it('fails on old node, missing git or missing claude, with a fix for each', () => {
    for (const [patch, id] of [[{ nodeVersion: 'v18.0.0' }, 'node'], [{ git: bad }, 'git'], [{ claude: bad }, 'claude']] as const) {
      const checks = evaluateDoctor({ ...healthy, ...patch });
      expect(doctorPassed(checks)).toBe(false);
      const failed = checks.find((c) => c.id === id)!;
      expect(failed.ok).toBe(false);
      expect(failed.fix).not.toBe('');
      expect(formatDoctor(checks)).toMatch(/MISSING/);
    }
  });

  it('passes on the .cmd explanation instead of a generic install hint', () => {
    const claude = evaluateDoctor({ ...healthy, claude: { ok: false, output: 'Found claude.cmd but Node cannot start it safely.' } }).find((c) => c.id === 'claude')!;
    expect(claude.fix).toMatch(/claude\.cmd/);
  });

  it('treats gh, gh sign-in and Chromium as recommended, not required', () => {
    const checks = evaluateDoctor({ ...healthy, gh: bad, ghAuth: bad, chromium: undefined });
    expect(doctorPassed(checks)).toBe(true);
    expect(checks.filter((c) => !c.ok).map((c) => c.id)).toEqual(['gh', 'gh-auth', 'chromium']);
    expect(checks.find((c) => c.id === 'gh-auth')!.fix).toBe(''); // fixing gh comes first
    expect(evaluateDoctor({ ...healthy, ghAuth: bad }).find((c) => c.id === 'gh-auth')!.fix).toMatch(/gh auth login/);
  });
});
