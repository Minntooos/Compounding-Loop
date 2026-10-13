import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Round 5 C3: the lane × hour heat map on the loop page and the Runs tab, one cell per expected slot with a glyph and a word.
const slot = (lane: string, hour: number, outcome: string, kind: string, extra: object = {}) =>
  ({ lane, at: `2026-10-13T${String(hour).padStart(2, '0')}:05:00Z`, outcome, kind, units: [], commits: [], ...extra });
const lane = (name: string) => ({ name, state: 'building', run: 3, limit: 20, locked: false, unanswered: [] });
const RUNS = [
  slot('web', 12, 'no-run-recorded', 'running'),
  slot('web', 11, 'pushed', 'worked', { units: ['C3 heat map', 'route'] }),
  slot('core', 11, 'tests-failed', 'tests-failed', { tests: { passed: 40, failed: 2 } }),
  slot('core', 10, 'no-run-recorded', 'missed'),
  slot('web', 10, 'nothing-pushed', 'idle'),
  slot('docs', 11, 'no-run-recorded', 'not-due'),
  slot('kit', 11, 'no-run-recorded', 'done'),
  slot('server', 11, 'no-run-recorded', 'paused'),
  slot('web', 0, 'pushed', 'worked'),
];
const LOOP = {
  id: 'self', name: 'self', state: 'building', reason: 'Building', round: 5, roundsTotal: 5, run: 0, runLimit: 0,
  lanes: ['core', 'kit', 'server', 'web', 'docs'].map(lane), timeline: [], contract: [], knowledge: [], decisions: [], runs: RUNS,
};

async function serve(page: Page, hash = '/#/loop/self') {
  await page.clock.install({ time: new Date('2026-10-13T12:40:00Z') });
  await page.route('**/api/health', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await page.route('**/live.json', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/loops.json', (r) => r.fulfill({ json: [LOOP] }));
  await page.route('**/api/loops/self.json', (r) => r.fulfill({ json: LOOP }));
  await page.route('**/api/inbox.json', (r) => r.fulfill({ json: [] }));
  await page.goto(hash);
}

test('every slot is a labelled cell and the legend has every outcome word', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/\/api\/health|\/live\.json/.test(m.location().url)) errors.push(m.text()); });
  await serve(page);
  const map = page.getByTestId('heatmap');
  await expect(map.getByRole('table')).toBeVisible();
  for (const label of ['web 12:05 UTC: likely running', 'web 11:05 UTC: worked, 2 units', 'core 11:05 UTC: failed, 2 failing', 'web 10:05 UTC: idle',
    'core 10:05 UTC: limit stop, no run logged (usage limit or a failed start)', 'docs 11:05 UTC: not due', 'kit 11:05 UTC: done', 'server 11:05 UTC: paused']) {
    await expect(map.getByRole('link', { name: label, exact: true })).toBeVisible();
  }
  await expect(map.getByTestId('heat-legend').getByRole('listitem')).toHaveText(['worked', 'idle', 'likely running', 'failed', 'limit stop', 'not due', 'paused', 'done']);
  await expect(map.getByRole('rowheader')).toHaveCount(5);
  expect(errors).toEqual([]);
});

test('focusing a cell shows its words; following it opens that slot in the Runs tab', async ({ page }) => {
  await serve(page);
  const map = page.getByTestId('heatmap');
  const cell = map.getByRole('link', { name: 'core 11:05 UTC: failed, 2 failing' });
  await cell.focus();
  await expect(map.getByTestId('heat-readout')).toHaveText('core 11:05 UTC: failed, 2 failing');
  await cell.click();
  await expect(page).toHaveURL(/#\/loop\/self\?tab=Runs&run=2026-10-13T11%3A05%3A00Z&lane=core$/);
  await expect(page.getByRole('tab', { name: 'Runs' })).toHaveAttribute('aria-selected', 'true');
  const picked = page.locator('[data-testid="run-row"][aria-current="true"]');
  await expect(picked).toHaveCount(1);
  await expect(picked).toContainText('core');
  await expect(picked).toContainText('Failed');
  await expect(picked.locator('svg[data-outcome="failed"]')).toHaveCount(1);
  // The same cell again, from the Timeline: no hashchange, still opens Runs.
  await page.getByRole('tab', { name: 'Timeline' }).click();
  await page.getByTestId('heatmap').getByRole('link', { name: 'core 11:05 UTC: failed, 2 failing' }).click();
  await expect(page.getByRole('tab', { name: 'Runs' })).toHaveAttribute('aria-selected', 'true');
  // A quiet slot has no row in the list: the tab says no run was expected.
  await page.getByTestId('heatmap').getByRole('link', { name: 'docs 11:05 UTC: not due' }).click();
  await expect(page.getByTestId('runs-picked-quiet')).toHaveText('docs 11:05 UTC: not due: no run was expected in that slot.');
});

test('the phone shows the last 12 h and can show all 24 inside its own scroller', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'phone fold only');
  await serve(page, '/#/loop/self?tab=Runs&run=x&lane=web');
  const map = page.getByTestId('heatmap');
  const old = map.getByRole('link', { name: 'web 00:05 UTC: worked' });
  await expect(old).toBeHidden();
  await map.getByRole('button', { name: 'Show 24 h' }).click();
  await expect(old).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

for (const theme of ['light', 'dark'] as const) {
  test(`axe: the heat map in the ${theme} theme`, async ({ page }) => {
    await page.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch { /* blocked */ } }, theme);
    await serve(page);
    await expect(page.getByTestId('heatmap')).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).include('[data-testid="heatmap"]').analyze();
    expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
