import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Round 5 C1 + C2: the status strip and the Needs-you rows, both fed by the one attention list.
const lane = (name: string, state: string) => ({ name, state, run: 3, limit: 20, locked: false, unanswered: [] });
const QUESTION = { loopId: 'asking', file: 'BLOCKED.md', question: 'Which port should the API use?', bestGuess: '8080', since: '2026-10-12T22:00:00Z' };

/** Four loops, one per Needs-you group: a question, a failing loop, a stalled lane and a waiting release. */
async function serve(page: Page, opts: { demo: boolean }) {
  const loopsUrl = opts.demo ? '**/api/loops.json' : '**/api/loops';
  if (opts.demo) await page.route('**/api/health', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  // Static fixtures, never route.fetch: a handler still fetching when the test ends fails it.
  const common = { repoUrl: 'https://github.com/o/r', round: 4, roundsTotal: 4, run: 0, runLimit: 0 };
  const loops = [
    { ...common, id: 'asking', name: 'asking', state: 'blocked', reason: 'Waiting for an answer' },
    { ...common, id: 'red', name: 'red', state: 'failing', reason: '2 tests fail', ci: { ok: false, reason: 'unit' } },
    { ...common, id: 'quiet', name: 'quiet', state: 'building', reason: 'Building', lanes: [lane('web', 'stalled'), lane('core', 'building')] },
    { ...common, id: 'ready', name: 'ready', state: 'done', reason: 'Round 4 done', lanes: [lane('core', 'done')] },
  ];
  await page.route(loopsUrl, (route) => route.fulfill({ json: loops }));
  // The waiting release's ship check, which the strip's Ship segment reads.
  const ship = { ready: false, items: [{ id: 'changelog', label: 'CHANGELOG has 0.5.0', ok: false, detail: 'missing' }], openFindings: [] };
  await page.route('**/api/loops/ready', (route) => route.fulfill({ json: { ...loops[3], ship, timeline: [], contract: [], knowledge: [], decisions: [] } }));
  await page.route(opts.demo ? '**/api/inbox.json' : '**/api/inbox', (r) => r.fulfill({ json: [QUESTION] }));
}

test('the strip states the fleet: what needs you, CI, and unknown limit stops', async ({ page }, info) => {
  // The phone strip uses shorter words (DESIGN.md §12 C1: two lines).
  const phone = info.project.name === 'phone';
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await serve(page, { demo: false });
  await page.goto('/');
  const strip = page.getByTestId('status-strip');
  await expect(strip.locator('[data-segment="state"]')).toHaveText(phone ? 'Stalled' : 'Stalled · quiet', { useInnerText: true });
  await expect(strip.getByRole('link', { name: '4 need you' })).toHaveAttribute('href', '#/inbox');
  await expect(strip.locator('[data-segment="ci"]')).toHaveText(phone ? 'CI failing' : 'CI failing · red', { useInnerText: true });
  await expect(strip.locator('[data-segment="limits"]')).toHaveText(phone ? 'Limits not checked' : 'Limit stops not checked', { useInnerText: true });
  if (!phone) await expect(strip.locator('[data-segment="round"]')).toHaveText('4 loops · 1 done', { useInnerText: true });
  else await expect(strip.locator('[data-segment="round"]')).toBeHidden();
  await expect(strip.locator('[data-segment="ship"]')).toHaveAttribute('href', '#/loop/ready');
  // Strip, nav badge and banner agree.
  await expect(page.getByTestId('nav-attention')).toHaveText('4', { useInnerText: true });
  await expect(page.getByRole('link', { name: /4 things need you/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Needs-you rows are ordered and carry their action inline (local)', async ({ page }) => {
  await serve(page, { demo: false });
  await page.goto('/');
  const rows = page.getByRole('list', { name: 'Needs you' }).getByTestId('attention-row');
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toContainText('Which port should the API use?');
  await expect(rows.nth(0).getByRole('link', { name: 'Answer' })).toHaveAttribute('href', '#/inbox');
  await expect(rows.nth(1).getByRole('link', { name: 'Open checks' })).toHaveAttribute('href', '#/health');
  await expect(rows.nth(2)).toContainText('Lane web is stalled');
  await rows.nth(2).getByText('What this means').click();
  await expect(rows.nth(2)).toContainText('usage limit');
  await expect(rows.nth(3).getByRole('link', { name: 'Review & release' })).toHaveAttribute('href', '#/loop/ready');
});

test('static demo: Needs-you actions open the exact GitHub editor page', async ({ page }) => {
  await serve(page, { demo: true });
  await page.goto('/');
  const rows = page.getByRole('list', { name: 'Needs you' }).getByTestId('attention-row');
  await expect(rows.nth(0).getByRole('link', { name: /Edit on GitHub/ })).toHaveAttribute('href', 'https://github.com/o/r/edit/main/BLOCKED.md');
  await expect(rows.nth(2).getByRole('link', { name: /Edit on GitHub/ })).toHaveAttribute('href', 'https://github.com/o/r/edit/main/.ai/schedule.json');
});

test('a loop page strip describes only that loop', async ({ page }, info) => {
  await page.goto('/#/loop/compounding-loop');
  const strip = page.getByTestId('status-strip');
  await expect(strip).toHaveAccessibleName('Loop status');
  await expect(strip.locator('[data-segment="state"]')).not.toContainText('·');
  // The demo self loop carries server's example run outcomes (two limit stops in the last 5 h).
  await expect(strip.locator('[data-segment="limits"]')).toHaveText(info.project.name === 'phone' ? '2 limit stops' : '2 limit stops in 5 h', { useInnerText: true });
});

test('at 375 px the strip puts state and needs-you on the first line and never scrolls the page', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await serve(page, { demo: false });
  await page.goto('/');
  const strip = page.getByTestId('status-strip');
  const top = async (id: string) => (await strip.locator(`[data-segment="${id}"]`).boundingBox())?.y ?? -1;
  await expect(strip.locator('[data-segment="ci"]')).toBeVisible();
  expect(await top('needs')).toBe(await top('state'));
  expect(await top('ci')).toBeGreaterThan(await top('state'));
  const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(scroll).toBeLessThanOrEqual(client);
});

for (const theme of ['light', 'dark'] as const) {
  test(`axe: strip and Needs-you rows in the ${theme} theme`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
    await serve(page, { demo: false });
    await page.goto('/');
    await expect(page.getByTestId('attention-row').first()).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
  });
}

test('an open tab re-reads the clock: Likely running turns Idle once the run window passes', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-13T03:00:00Z') });
  const loop = { id: 'one', name: 'one', state: 'building', reason: 'Building', round: 1, roundsTotal: 2, run: 1, runLimit: 20, lastRun: { lane: 'web', at: '2026-10-13T02:15:00Z', outcome: 'pushed' } };
  await page.route('**/api/loops', (r) => r.fulfill({ json: [loop] }));
  await page.route('**/api/inbox', (r) => r.fulfill({ json: [] }));
  await page.goto('/');
  const state = page.getByTestId('status-strip').locator('[data-segment="state"]');
  await expect(state).toHaveText('Likely running', { useInnerText: true });
  await page.clock.fastForward('06:00');
  await expect(state).toHaveText('Idle', { useInnerText: true });
});

test('at 375 px a loop page strip stays on two lines (the round is in the loop header)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/#/loop/compounding-loop');
  const strip = page.getByTestId('status-strip');
  await expect(strip.locator('[data-segment="ci"]')).toBeVisible();
  await expect(strip.locator('[data-segment="round"]')).toBeHidden();
  const tops = await strip.locator('[data-segment]').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().width > 0).map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBeLessThanOrEqual(2);
});
