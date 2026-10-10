import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const lane = (name: string, state: string, extra: object = {}) => ({
  name, state, run: 7, limit: 30, locked: state === 'building', unanswered: [],
  lastCommit: { sha: 'abcdef1234567', subject: `${name}: ship the thing`, at: new Date(Date.now() - 3_600_000).toISOString() }, ...extra,
});
const LANES = [
  lane('core', 'done'),
  lane('server', 'building'),
  lane('web', 'stalled', { unanswered: [{ from: 'web', to: 'server', at: new Date().toISOString(), text: 'need the lanes route' }] }),
  lane('kit', 'waiting', { waitingOn: ['core'] }),
];

// Serve the demo with a laned loop added: the dashboard must show lanes whenever the API sends them.
async function withLanedLoop(page: Page) {
  await page.route('**/api/loops', async (route) => {
    const res = await route.fetch();
    const loops = (await res.json()) as Record<string, unknown>[];
    await route.fulfill({ response: res, json: [...loops, { ...loops[0], id: 'laned', name: 'laned-loop', state: 'failing', reason: 'lane web is stalled', lanes: LANES }] });
  });
  await page.route('**/api/loops/laned', async (route) => {
    const res = await route.fetch({ url: route.request().url().replace('/laned', '/proj2') });
    const loop = (await res.json()) as Record<string, unknown>;
    await route.fulfill({ response: res, json: { ...loop, id: 'laned', name: 'laned-loop', state: 'failing', lanes: LANES } });
  });
}

test('fleet card shows a lane strip and Needs you counts stalled and orphaned lanes', async ({ page }) => {
  await withLanedLoop(page);
  await page.goto('/');
  const card = page.getByTestId('loop-card').filter({ hasText: 'laned-loop' });
  await expect(card.getByTestId('lane-chip')).toHaveCount(4);
  await expect(card.getByTestId('lane-chip').nth(2)).toContainText('Stalled');
  // web is stalled, kit waits on the finished core lane: 2 things.
  await expect(page.getByRole('link', { name: '2 things need you' })).toBeVisible();
});

test('loop detail has a Lanes tab with a row per lane, run counters, lock and unanswered messages', async ({ page }) => {
  await withLanedLoop(page);
  await page.goto('/#/loop/laned');
  await expect(page.getByRole('tab').nth(1)).toHaveText('Lanes');
  await page.getByRole('tab', { name: 'Lanes' }).click();
  const rows = page.getByTestId('lane-row');
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(1)).toContainText('Building');
  await expect(rows.nth(1)).toContainText('Run 7/30');
  await expect(rows.nth(1)).toContainText('Locked');
  await expect(rows.nth(2)).toContainText('Stalled');
  await expect(rows.nth(2)).toContainText('web → server: need the lanes route');
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
});

test('a loop without lanes has no Lanes tab', async ({ page }) => {
  await page.goto('/#/loop/proj2');
  await expect(page.getByRole('tab', { name: 'Timeline' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Lanes' })).toHaveCount(0);
});

test('fleet filter by status narrows the cards and can be cleared', async ({ page }) => {
  await withLanedLoop(page);
  await page.goto('/');
  const cards = page.getByTestId('loop-card');
  await expect(cards.first()).toBeVisible();
  const all = await cards.count();
  await page.getByRole('button', { name: /^Failing \(1\)/ }).click();
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('laned-loop');
  await page.getByRole('button', { name: /^All/ }).click();
  await expect(cards).toHaveCount(all);
});

test('the demo serves this repo as a laned loop with five finished lanes', async ({ page }) => {
  await page.goto('/#/loop/compounding-loop');
  await page.getByRole('tab', { name: 'Lanes' }).click();
  const rows = page.getByTestId('lane-row');
  await expect(rows).toHaveCount(5);
  for (let i = 0; i < 5; i++) await expect(rows.nth(i)).toContainText('Done');
});
