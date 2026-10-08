import { mkdirSync } from 'node:fs';
import { test } from '@playwright/test';

// Not part of `npm test`: run `SCREENS=1 npx playwright test screenshots --project=laptop` to refresh docs/assets/screens/.
const screens: Record<string, string> = { fleet: '/', loop: '/loop/proj2', inbox: '/inbox', health: '/health', settings: '/settings', new: '/new' };

test.skip(!process.env['SCREENS'], 'screenshots are generated on demand');

for (const theme of ['light', 'dark'] as const) {
  for (const [name, route] of Object.entries(screens)) {
    test(`screenshot ${name} ${theme}`, async ({ page }, info) => {
      const dir = 'docs/assets/screens';
      mkdirSync(dir, { recursive: true });
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(`/#${route}`);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: `${dir}/${name}-${theme}-${info.project.name}.png`, fullPage: true });
    });
  }
}
