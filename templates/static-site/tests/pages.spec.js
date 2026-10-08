// Checks every page in the sitemap in a real browser. Feature tests for the site's tools go in their own files.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const paths = [...readFileSync('site/sitemap.xml', 'utf8').matchAll(/<loc>https:\/\/[^/]+(\/[^<]*)<\/loc>/g)].map((m) => m[1]);

for (const path of paths) {
  test(`${path} loads cleanly`, async ({ page }) => {
    const problems = [];
    page.on('pageerror', (e) => problems.push(`JS error: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && problems.push(`console error: ${m.text()}`));

    const res = await page.goto(path);
    expect(res.status(), `${path} should return 200`).toBe(200);
    await expect(page.locator('h1')).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, 'page scrolls sideways: find the element wider than the screen').toBeLessThanOrEqual(0);
    expect(problems, 'fix these errors').toEqual([]);
  });
}
