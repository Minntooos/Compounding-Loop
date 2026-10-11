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
