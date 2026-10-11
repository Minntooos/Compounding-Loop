import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Demo mode = no dashboard server: /api/health answers 404, so the dashboard shows its bundled snapshot.
async function withoutServer(page: Page) {
  await page.route('**/api/health', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
}

test('demo mode greets a first-time visitor with the install command and a snapshot label', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await withoutServer(page);
  await page.goto('/#/');
  const strip = page.getByRole('region', { name: 'About this dashboard' });
  await expect(strip).toContainText('runs Claude Code build loops unattended');
  await expect(strip.getByRole('link', { name: 'View on GitHub' })).toHaveAttribute('href', 'https://github.com/Minntooos/Compounding-Loop');
  await expect(page.getByText(/^Snapshot (from\s)?\d+ \w{3}$/)).toBeVisible();
  await expect(page.getByText('Sample data')).toHaveCount(0);
  await strip.getByRole('button', { name: 'Copy' }).click();
  await expect(strip.getByRole('button', { name: 'Copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('npx compounding-loop dashboard');
});

test('dismissing the strip remembers the choice', async ({ page }) => {
  await withoutServer(page);
  await page.goto('/#/');
  await page.getByRole('button', { name: 'Dismiss this introduction' }).click();
  await expect(page.getByRole('region', { name: 'About this dashboard' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('region', { name: 'About this dashboard' })).toHaveCount(0);
});

test('a running dashboard server never shows the strip or the snapshot label', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('region', { name: 'About this dashboard' })).toHaveCount(0);
  await expect(page.getByText(/^Snapshot /)).toHaveCount(0);
});

for (const theme of ['light', 'dark'] as const) {
  test(`axe: demo mode with the welcome strip in the ${theme} theme`, async ({ page }) => {
    await withoutServer(page);
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/#/');
    await expect(page.getByRole('region', { name: 'About this dashboard' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await page.waitForLoadState('networkidle');
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    const bad = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
  });
}

test('at 375 px the snapshot label, theme toggle and brand share one row', async ({ page }) => {
  await withoutServer(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/#/');
  const brand = await page.getByRole('link', { name: 'Compounding Loop' }).first().boundingBox();
  const toggle = await page.getByRole('button', { name: /theme/ }).boundingBox();
  expect(Math.abs((toggle?.y ?? 0) - (brand?.y ?? 99))).toBeLessThan(20);
});
