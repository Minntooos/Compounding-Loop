import { expect, test, type Page } from '@playwright/test';
import { DEMO_LOOPS, pinDemoLoops } from './demoLoops';

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

const SITES: [string, number][] = [
  ['powerstationruntime.netlify.app', 278], ['clearpoolmath.netlify.app', 543], ['yarnsums.netlify.app', 419],
  ['quiltcalculators.netlify.app', 452], ['mathtank.netlify.app', 433],
];

test('fleet shows the five demo sites with their numbers and the release waiting on the owner', async ({ page }) => {
  const errors = trackErrors(page);
  await pinDemoLoops(page);
  await page.goto('/');
  await expect(page.getByRole('link', { name: /1 thing needs you/ })).toBeVisible();
  const cards = page.getByTestId('loop-card');
  // The demo also has a sixth loop (this repo, with lanes); the five sites are the ones with a netlify.app name.
  await expect(cards.filter({ hasText: 'netlify.app' })).toHaveCount(5);
  for (const [name, passed] of SITES) {
    const card = cards.filter({ hasText: name });
    await expect(card).toContainText('Done');
    await expect(card).toContainText('Round 5 of 5 done');
    await expect(card).not.toContainText('runs');
    await expect(card).toContainText(`${passed} passed`);
  }
  expect(errors).toEqual([]);
});

test('no horizontal scroll at 375px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto('/');
  await expect(page.getByTestId('loop-card').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('theme toggle switches and persists the theme', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');
  const before = await html.getAttribute('data-theme');
  await page.getByRole('button', { name: /Switch to (light|dark) theme/ }).click();
  const after = await html.getAttribute('data-theme');
  expect(after).not.toBe(before);
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', after!);
});

test('keyboard: tab reaches nav and cards with visible focus; Ctrl+K palette navigates', async ({ page, isMobile }) => {
  await page.goto('/');
  await expect(page.getByTestId('loop-card').first()).toBeVisible();
  // Tab through the whole page: every stop must show a focus outline, and a loop card must be reachable.
  let reachedCard = false;
  for (let i = 0; i < 15 && !reachedCard; i++) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      return { card: el.dataset.testid === 'loop-card', outline: getComputedStyle(el).outlineStyle };
    });
    expect(stop.outline).not.toBe('none');
    reachedCard = stop.card;
  }
  expect(reachedCard).toBe(true);
  test.skip(isMobile, 'no keyboard shortcuts on touch');
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox').fill('health');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/health/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Health');
});

test('cards show a round bar (run budget only while running); the self-build card comes first; no empty rows', async ({ page }) => {
  await pinDemoLoops(page);
  await page.goto('/');
  const cards = page.getByTestId('loop-card');
  await expect(cards.first()).toContainText('compounding-loop');
  const bars = cards.first().getByRole('progressbar');
  await expect(bars).toHaveCount(1);
  await expect(bars.first()).toHaveAttribute('aria-valuemax', /\d+/);
  const text = await cards.allInnerTexts();
  for (const t of text) expect(t).not.toMatch(/no result|not checked/);
});

test('timeline groups commits by day, names each lane and filters by lane', async ({ page }) => {
  await page.goto('/#/loop/compounding-loop');
  const timeline = page.getByTestId('timeline');
  await expect(timeline.getByRole('heading').first()).toHaveText(/^\w{3} \d{1,2} \w{3}\s*\d+ commits?$/);
  await expect(timeline.locator('time').first()).toHaveText(/^\d\d:\d\d UTC$/);
  const total = await timeline.locator('li').count();
  const web = page.getByRole('group', { name: 'Filter by lane' }).getByRole('button', { name: 'web' });
  await web.click();
  await expect(web).toHaveAttribute('aria-pressed', 'true');
  const shown = await timeline.locator('li').count();
  expect(shown).toBeGreaterThan(0);
  expect(shown).toBeLessThan(total);
  for (const lane of await timeline.locator('li').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.lane))) expect(lane).toBe('web');
});

test('the status filter counts cards by their badge: a paused loop is under Paused, not Building', async ({ page }) => {
  const errors = trackErrors(page);
  const paused = { ...DEMO_LOOPS[0], id: 'paused-one', name: 'paused-one', state: 'building', paused: { by: 'owner' } };
  await pinDemoLoops(page, [paused]);
  await page.goto('/');
  const filters = page.getByRole('group', { name: 'Filter by status' });
  await expect(filters.getByRole('button', { name: /^Building/ })).toHaveCount(0);
  // DESIGN.md: 44 px touch targets on a phone.
  if (page.viewportSize()!.width < 640) expect((await filters.getByRole('button', { name: 'All (7)' }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await filters.getByRole('button', { name: 'Paused (1)' }).click();
  const cards = page.getByTestId('loop-card');
  await expect(cards).toHaveCount(1);
  await expect(cards.getByTestId('status-badge')).toHaveText('Paused');
  expect(errors).toEqual([]);
});

test('a chosen filter that a live update empties falls back to every card', async ({ page }) => {
  const paused = { ...DEMO_LOOPS[0], id: 'paused-one', name: 'paused-one', state: 'building', paused: { by: 'owner' } };
  let loops = [...DEMO_LOOPS, paused];
  await page.route('**/api/loops', (route) => route.fulfill({ json: loops }));
  // The demo server only sends `ready`, so drive the live-update listener by hand (as in toasts.spec.ts).
  await page.addInitScript(() => {
    class FakeEventSource {
      listeners: Record<string, (() => void)[]> = {};
      constructor() { (window as unknown as { fakeEs: FakeEventSource }).fakeEs = this; }
      addEventListener(type: string, fn: () => void) { (this.listeners[type] ??= []).push(fn); }
      close() { /* nothing to close */ }
      emit(type: string) { this.listeners[type]?.forEach((fn) => fn()); }
    }
    (window as unknown as { EventSource: unknown }).EventSource = FakeEventSource;
  });
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as unknown as { fakeEs?: unknown }).fakeEs));
  await page.getByRole('group', { name: 'Filter by status' }).getByRole('button', { name: 'Paused (1)' }).click();
  await expect(page.getByTestId('loop-card')).toHaveCount(1);
  // The owner resumes it: the Paused filter is gone, so the fleet shows every card instead of an empty grid.
  loops = [...DEMO_LOOPS, { ...paused, state: 'done', paused: undefined }];
  await page.evaluate(() => (window as unknown as { fakeEs: { emit(t: string): void } }).fakeEs.emit('loop-updated'));
  await expect(page.getByTestId('loop-card')).toHaveCount(DEMO_LOOPS.length + 1);
});
