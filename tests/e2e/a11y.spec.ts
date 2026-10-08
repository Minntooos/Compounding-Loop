import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const screens = ['/', '/loop/proj2', '/inbox', '/health', '/settings', '/new'];

// Zero serious or critical axe violations on every screen, in both themes, at laptop and phone width (the two Playwright projects).
for (const theme of ['light', 'dark'] as const) {
  for (const screen of screens) {
    test(`axe: ${screen} in the ${theme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(`/#${screen}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await page.waitForLoadState('networkidle');
      const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      const bad = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    });
  }
}
