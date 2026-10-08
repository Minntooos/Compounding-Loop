import { defineConfig, chromium } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';

// Cloud sandboxes can block Playwright's own browser download. If that browser is missing, use a preinstalled
// Playwright Chromium (Claude's cloud VMs have one in /opt/pw-browsers) or a system Chrome.
const bundled = (() => { try { return chromium.executablePath(); } catch { return ''; } })();
const preinstalled = ['/opt/pw-browsers', `${process.env.HOME}/.cache/ms-playwright`].flatMap((dir) => {
  try {
    return readdirSync(dir).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => b.localeCompare(a, 'en', { numeric: true }))
      .flatMap((d) => [`${dir}/${d}/chrome-linux64/chrome`, `${dir}/${d}/chrome-linux/chrome`]);
  } catch { return []; }
});
const systemChrome = [process.env.CHROME_PATH, ...preinstalled, '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/opt/google/chrome/chrome']
  .find((p) => p && existsSync(p));
// Read by tests/popup.spec.js, which launches its own persistent context (extensions need one).
process.env.CL_CHROME = bundled && existsSync(bundled) ? bundled : systemChrome ?? '';

export default defineConfig({
  testDir: 'tests',
  timeout: 30_000,
  workers: 1,
});
