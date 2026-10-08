// Loads the unpacked extension in a real Chromium and drives its popup.
import { test, expect, chromium } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const extension = resolve('extension');

test('popup counts clicks and keeps them in chrome.storage', async () => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'ext-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    ...(process.env.CL_CHROME ? { executablePath: process.env.CL_CHROME } : {}),
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--headless=new'],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const id = new URL(worker.url()).host;

    const problems = [];
    const popup = await context.newPage();
    popup.on('pageerror', (e) => problems.push(`JS error: ${e.message}`));
    popup.on('console', (m) => m.type() === 'error' && problems.push(`console error: ${m.text()}`));
    await popup.goto(`chrome-extension://${id}/popup.html`);

    await expect(popup.locator('h1')).toBeVisible();
    await expect(popup.locator('#count')).toHaveText('0');
    await popup.locator('#click').click();
    await expect(popup.locator('#count')).toHaveText('1');

    await popup.reload();
    await expect(popup.locator('#count'), 'the count must survive a reload').toHaveText('1');
    expect(problems, 'fix these errors').toEqual([]);
  } finally {
    await context.close();
    rmSync(userDataDir, { recursive: true, force: true });
  }
});
