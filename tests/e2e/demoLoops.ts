import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';

/**
 * The demo fleet as `/api/loops` served it in round 4: five finished sites plus this repo as a finished laned loop with a
 * release waiting (1 thing needs you). Tests that count attention items pin it, so server can move the demo's self loop
 * to the current round without breaking them. Refresh: `curl localhost:<port>/api/loops` from `loop dashboard --demo`.
 */
export const DEMO_LOOPS = JSON.parse(readFileSync(new URL('./fixtures/demo-loops-done-self.json', import.meta.url), 'utf8')) as Record<string, unknown>[];

/** Serves the pinned fleet, plus any extra loops, for `/api/loops` (a static fulfil, never `route.fetch`). */
export async function pinDemoLoops(page: Page, extra: Record<string, unknown>[] = []): Promise<void> {
  await page.route('**/api/loops', (route) => route.fulfill({ json: [...DEMO_LOOPS, ...extra] }));
}
