import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

// Not part of `npm test`. Run with the laptop project only:
//   SCREENS=1 npx playwright test screenshots --project=laptop
// writes the docs set (README and docs/*.md) to web/design/docs: laptop 1440x900 @1x and phone 375x812 @2x,
// each cut to the top of the page (about one and two-thirds laptop screens, one and a half phone screens) and under 400 kB
// (IDEA.md Round 5 D). docs owns docs/assets/screens and copies them from there.
// Design-review sets (before/after, 1440 and 375 px @1x, both themes, full page):
//   SCREENS=1 SCREENS_DIR=web/design/before npx playwright test screenshots --project=laptop
const screens: Record<string, string> = { fleet: '/', loop: '/loop/proj2', self: '/loop/compounding-loop', inbox: '/inbox', health: '/health', settings: '/settings', new: '/new' };
const reviewDir = process.env['SCREENS_DIR'];
const dir = reviewDir ?? join('web', 'design', 'docs');
const MAX_BYTES = 400 * 1024;

// maxHeight (CSS px) cuts the docs set; a dense timeline at full height is unreadable in a README and far over 400 kB.
interface Shot { size: string; width: number; height: number; scale: number; maxHeight?: number }
const shots: Shot[] = reviewDir
  ? [{ size: 'desktop', width: 1440, height: 900, scale: 1 }, { size: 'phone', width: 375, height: 812, scale: 1 }]
  : [{ size: 'laptop', width: 1440, height: 900, scale: 1, maxHeight: 1500 }, { size: 'phone', width: 375, height: 812, scale: 2, maxHeight: 1218 }];

test.skip(!process.env['SCREENS'], 'screenshots are generated on demand');
// Each shot sets its own viewport; a second project would only write the same files twice.
// Playwright requires a destructuring pattern for the fixtures argument, hence `{}`.
test.beforeEach(({}, info) => test.skip(info.project.name !== 'laptop', 'shot once, from the laptop project'));

async function shoot(page: Page, shot: Shot, path: string): Promise<void> {
  if (!shot.maxHeight) {
    await page.screenshot({ path, fullPage: true });
    return;
  }
  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const height = Math.min(pageHeight, shot.maxHeight);
  await page.screenshot({ path, fullPage: true, clip: { x: 0, y: 0, width: shot.width, height } });
}

for (const shot of shots) {
  for (const theme of ['light', 'dark'] as const) {
    for (const [name, route] of Object.entries(screens)) {
      test(`screenshot ${name} ${theme} ${shot.size}`, async ({ browser, baseURL }) => {
        mkdirSync(dir, { recursive: true });
        const context = await browser.newContext({
          baseURL,
          viewport: { width: shot.width, height: shot.height },
          deviceScaleFactor: shot.scale,
          isMobile: shot.size === 'phone',
          hasTouch: shot.size === 'phone',
          colorScheme: theme,
        });
        const page = await context.newPage();
        // Shoot demo mode as a visitor sees it (welcome strip, snapshot chip): no dashboard server.
        // The self-build loop only exists on a running server (the bundled snapshot is the five sites).
        if (name !== 'self') await page.route('**/api/health', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
        await page.goto(`/#${route}`);
        await page.waitForLoadState('networkidle');
        const path = join(dir, `${name}-${theme}-${shot.size}.png`);
        await shoot(page, shot, path);
        await context.close();
        if (!reviewDir) expect(statSync(path).size, `${path} must stay under 400 kB`).toBeLessThan(MAX_BYTES);
      });
    }
  }
}
