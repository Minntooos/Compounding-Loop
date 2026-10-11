import { mkdirSync } from 'node:fs';
import { test } from '@playwright/test';

// Not part of `npm test`. Refresh the shipped screens with `SCREENS=1 npx playwright test screenshots --project=laptop`.
// Design-review sets (before/after, 1440 and 375 px, both themes):
//   SCREENS=1 SCREENS_DIR=web/design/before npx playwright test screenshots --project=laptop
const screens: Record<string, string> = { fleet: '/', loop: '/loop/proj2', inbox: '/inbox', health: '/health', settings: '/settings', new: '/new' };
const sizes: Record<string, { width: number; height: number }> = { desktop: { width: 1440, height: 900 }, phone: { width: 375, height: 812 } };

test.skip(!process.env['SCREENS'], 'screenshots are generated on demand');

const dir = process.env['SCREENS_DIR'] ?? 'docs/assets/screens';
const sets = process.env['SCREENS_DIR'] ? Object.entries(sizes) : [['', undefined] as const];

for (const [size, viewport] of sets) {
  for (const theme of ['light', 'dark'] as const) {
    for (const [name, route] of Object.entries(screens)) {
      test(`screenshot ${name} ${theme} ${size}`, async ({ page }, info) => {
        mkdirSync(dir, { recursive: true });
        if (viewport) await page.setViewportSize(viewport);
        await page.emulateMedia({ colorScheme: theme });
        await page.goto(`/#${route}`);
        await page.waitForLoadState('networkidle');
        const file = size ? `${name}-${theme}-${size}.png` : `${name}-${theme}-${info.project.name}.png`;
        await page.screenshot({ path: `${dir}/${file}`, fullPage: true });
      });
    }
  }
}
