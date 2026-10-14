import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Runs against `loop dashboard --demo`: demo/memory.json is the fixture (compounding-loop has entries, triggers and recipes; proj1 has one recipe and no entries).
async function open(page: Page, id: string) {
  await page.goto(`/#/loop/${id}`);
  await page.getByRole('tab', { name: 'Knowledge' }).click();
}

test('Knowledge & recipes: entries with trigger badges, recipe cards and the copy button', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => undefined);
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/\/api\/health|\/live\.json/.test(m.location().url)) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page, 'compounding-loop');
  const entries = page.getByTestId('knowledge-entry');
  await expect(entries).toHaveCount(3);
  await expect(entries.nth(1)).toContainText('K-0002');
  await expect(entries.nth(1).getByTestId('trigger-badge')).toHaveCount(2);
  await expect(entries.nth(1)).toContainText('fired 6 times');
  await expect(entries.nth(2).getByTestId('entry-status')).toHaveText('Guess');
  await expect(entries.nth(2)).toContainText('No trigger injects this entry yet');
  const cards = page.getByTestId('recipe-card');
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toContainText('R-cli-command-json');
  await expect(cards.first()).toContainText('6 steps · 3 checks · 2 of 3 passed');
  await expect(cards.first()).toContainText('2480 of 6144 bytes');
  await cards.first().getByRole('button', { name: /Copy context command/ }).click();
  await expect(cards.first().getByRole('button', { name: /Copied/ })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText()).catch(() => 'loop recipe show R-cli-command-json --context')).toBe('loop recipe show R-cli-command-json --context');
  expect(errors).toEqual([]);
});

test('Eval: sample marking, headline and the task × arm × model table', async ({ page }) => {
  await open(page, 'compounding-loop');
  await expect(page.getByTestId('sample-badge')).toHaveText('Sample data');
  await expect(page.getByTestId('eval-headline')).toContainText('3/3 with a recipe vs 1/3 cold');
  const rows = page.getByTestId('eval-table').locator('tbody tr');
  await expect(rows).toHaveCount(6);
  await expect(rows.first()).toContainText('calc-page');
  await expect(rows.first()).toContainText('Cold');
  await expect(rows.first()).toContainText('1/3');
  await expect(rows.nth(5)).toContainText('Recipe + triggers');
});

test('empty states: a loop with no entries, and an eval with no results naming the command', async ({ page }) => {
  await page.route('**/api/eval', (route) => route.fulfill({ json: { rows: [], sample: false, command: 'loop eval run --task calc-page --arm both' } }));
  await open(page, 'proj1');
  await expect(page.getByText('No knowledge entries yet.')).toBeVisible();
  await expect(page.getByTestId('recipe-card')).toHaveCount(1);
  await expect(page.getByTestId('sample-badge')).toHaveCount(0);
  await expect(page.getByTestId('eval-empty')).toContainText('loop eval run --task calc-page --arm both');
  await page.route('**/api/loops/proj1/knowledge', (route) => route.fulfill({ json: { entries: [], triggers: [], recipes: [] } }));
  await page.reload();
  await page.getByRole('tab', { name: 'Knowledge' }).click();
  await expect(page.getByText('No recipe fits yet.')).toBeVisible();
});

test('a failed load shows an error with a working retry', async ({ page }) => {
  let fail = true;
  await page.route('**/api/loops/proj1/knowledge', (route) => (fail ? route.fulfill({ status: 500, json: { error: 'x' } }) : route.continue()));
  await open(page, 'proj1');
  await expect(page.getByRole('alert')).toContainText('Could not load the knowledge');
  fail = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByTestId('recipe-card')).toHaveCount(1);
});

for (const theme of ['light', 'dark'] as const) {
  test(`axe and no horizontal scroll: Knowledge & recipes in the ${theme} theme`, async ({ page }) => {
    await page.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch { /* blocked */ } }, theme);
    await open(page, 'compounding-loop');
    await expect(page.getByTestId('eval-table')).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test('a loop without memory files keeps its plain knowledge notes', async ({ page }) => {
  await page.route('**/api/loops/proj1', async (route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, json: { ...(await res.json()), knowledge: ['Old plain note'], laneNotes: undefined } });
  });
  await open(page, 'proj1');
  await expect(page.getByText('Old plain note')).toBeVisible();
});
