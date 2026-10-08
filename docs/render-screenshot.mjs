// Regenerates docs/assets/dashboard.png from the demo dashboard. Needs `npm run build` first.
// Run: node docs/render-screenshot.mjs
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = 4179;
const server = spawn(process.execPath, ['bin/loop.js', 'dashboard', '--demo', '--no-open', '--port', String(port)], { cwd: root, stdio: 'ignore' });
try {
  const url = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`${url}api/health`)).ok) break; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  const exe = ['/opt/pw-browsers/chromium'].find(existsSync);
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(url);
  await page.waitForSelector('main');
  await page.waitForTimeout(800);
  await page.screenshot({ path: fileURLToPath(new URL('assets/dashboard.png', import.meta.url)) });
  await browser.close();
} finally {
  server.kill();
}
