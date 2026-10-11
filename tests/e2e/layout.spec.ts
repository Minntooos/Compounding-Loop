import { expect, test } from '@playwright/test';

const screens = ['/', '/loop/proj2', '/loop/compounding-loop', '/inbox', '/health', '/settings', '/new'];

// 375 px is the narrowest phone we design for: nothing may force a sideways scroll.
test.use({ viewport: { width: 375, height: 800 } });

for (const screen of screens) {
  test(`no horizontal overflow at 375 px: ${screen}`, async ({ page }) => {
    await page.goto(`/#${screen}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.waitForLoadState('networkidle');
    const { scroll, client } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(scroll).toBeLessThanOrEqual(client);
  });
}

// Long names, paths and lane messages must wrap, not push the page sideways.
test('long loop names and lane messages do not overflow at 375 px', async ({ page }) => {
  const longName = `${'very-long-project-name-'.repeat(6)}end`;
  const longText = `/home/someone/${'deeply/nested/'.repeat(12)}file.md ${'x'.repeat(120)}`;
  const lanes = [{
    name: 'web', state: 'stalled', run: 7, limit: 30, locked: false,
    lastCommit: { sha: 'abcdef1234567', subject: longText, at: new Date().toISOString() },
    unanswered: [{ from: 'web', to: 'server', at: new Date().toISOString(), text: longText }],
  }];
  await page.route('**/api/loops', async (route) => {
    const res = await route.fetch();
    const loops = (await res.json()) as Record<string, unknown>[];
    await route.fulfill({ response: res, json: [{ ...loops[0], id: 'long', name: longName, reason: longText, lanes }, ...loops] });
  });
  await page.route('**/api/loops/long', async (route) => {
    const res = await route.fetch({ url: route.request().url().replace('/long', '/proj2') });
    const loop = (await res.json()) as Record<string, unknown>;
    await route.fulfill({ response: res, json: { ...loop, id: 'long', name: longName, lanes } });
  });
  for (const hash of ['/', '/loop/long']) {
    await page.goto(`/#${hash}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    if (hash !== '/') await page.getByRole('tab', { name: 'Lanes' }).click();
    await page.waitForLoadState('networkidle');
    const { scroll, client } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(scroll, hash).toBeLessThanOrEqual(client);
  }
});
