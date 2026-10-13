import type { Page } from '@playwright/test';

/**
 * The e2e server is `loop dashboard --demo`, whose /api/health says `demo: true`, so the write controls take the demo path.
 * Tests of the local path (Save, Wake, Draft with Claude) call this first: health then reads like `loop dashboard --projects`.
 */
export async function writableServer(page: Page): Promise<void> {
  await page.route('**/api/health', (r) => r.fulfill({ json: { ok: true, version: '0.0.0', demo: false } }));
}
