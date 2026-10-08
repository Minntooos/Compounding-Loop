import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { dashboardSettings, parseGhLogin } from '../../../src/server/settings.js';

describe('parseGhLogin', () => {
  it('accepts a plain login and trims the newline', () => {
    expect(parseGhLogin('Minntooos\n')).toBe('Minntooos');
  });
  it('rejects empty, multi-line or odd output', () => {
    for (const out of ['', '\n', 'a b', 'gh: not logged in\nrun gh auth login', '-dash', 'x'.repeat(40)]) expect(parseGhLogin(out)).toBeUndefined();
  });
});

describe('dashboardSettings', () => {
  it('omits ghAccount when gh has none', async () => {
    expect(await dashboardSettings({ demo: false, projectsDir: '.' }, async () => undefined)).toEqual({ demo: false, projectsDir: path.resolve('.'), defaultRunner: 'routine' });
  });
});
