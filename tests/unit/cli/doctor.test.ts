import { describe, expect, it } from 'vitest';
import { findChromium, playwrightCacheDirs, probe, runDoctor } from '../../../src/cli/doctor.js';

describe('loop doctor (cli)', () => {
  it('reports pass and fail from injected probes', async () => {
    const base = { nodeVersion: 'v22.0.0', git: { ok: true, output: 'git version 2' }, gh: { ok: false, output: '' }, ghAuth: { ok: false, output: '' }, chromium: undefined };
    expect((await runDoctor(async () => ({ ...base, claude: { ok: true, output: '2.1' } }))).passed).toBe(true);
    const failing = await runDoctor(async () => ({ ...base, claude: { ok: false, output: '' } }));
    expect(failing.passed).toBe(false);
    expect(failing.report).toMatch(/Install Claude Code/);
  });

  it('probe never throws', async () => {
    expect(await probe('definitely-not-a-real-command-xyz', ['--version'])).toMatchObject({ ok: false });
    expect(await probe(process.execPath, ['--version'])).toMatchObject({ ok: true });
  });

  it('knows where Playwright keeps browsers on each platform', () => {
    expect(playwrightCacheDirs({ PLAYWRIGHT_BROWSERS_PATH: '/pw' }, 'linux', '/home/a')).toEqual(['/pw']);
    expect(playwrightCacheDirs({}, 'darwin', '/Users/a')).toEqual(['/Users/a/Library/Caches/ms-playwright']);
    expect(playwrightCacheDirs({ LOCALAPPDATA: 'C:\\L' }, 'win32', 'C:\\U')).toEqual(['C:\\L\\ms-playwright']);
    expect(playwrightCacheDirs({}, 'linux', '/home/a')).toContain('/opt/pw-browsers');
  });

  it('finds a chromium folder in the first cache dir that has one', async () => {
    const list = async (dir: string) => { if (dir === '/b') return ['ffmpeg-1', 'chromium-1200']; throw new Error('ENOENT'); };
    expect(await findChromium(['/a', '/b'], list)).toBe('/b/chromium-1200'.replace(/\//g, process.platform === 'win32' ? '\\' : '/'));
    expect(await findChromium(['/a'], list)).toBeUndefined();
  });
});
