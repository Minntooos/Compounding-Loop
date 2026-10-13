import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Round 5 C4: the steer composer shows the exact steer.md entry and, on the demo, opens GitHub's editor for that file.
const lane = (name: string) => ({ name, state: 'building', run: 3, limit: 20, locked: false, unanswered: [] });
const LOOP = { id: 'self', name: 'self', state: 'building', reason: 'Building', repoUrl: 'https://github.com/o/r', round: 5, roundsTotal: 5, run: 0, runLimit: 0, lanes: [lane('core'), lane('web')], timeline: [], contract: [], knowledge: [], decisions: [] };

async function serve(page: Page, opts: { demo: boolean }) {
  await page.clock.install({ time: new Date('2026-10-13T14:05:00Z') });
  if (opts.demo) await page.route('**/api/health', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  // A snapshot demo without live mode: no live.json, so no GitHub reads.
  if (opts.demo) await page.route('**/live.json', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await page.route(opts.demo ? '**/api/loops.json' : '**/api/loops', (r) => r.fulfill({ json: [LOOP] }));
  await page.route(opts.demo ? '**/api/loops/self.json' : '**/api/loops/self', (r) => r.fulfill({ json: LOOP }));
  await page.route(opts.demo ? '**/api/inbox.json' : '**/api/inbox', (r) => r.fulfill({ json: [] }));
  // Record what window.open is asked to open instead of leaving for GitHub.
  await page.addInitScript(() => { (window as unknown as { opened: string[] }).opened = []; window.open = (url?: string | URL) => { (window as unknown as { opened: string[] }).opened.push(String(url)); return null; }; });
}

test('demo: the preview is the exact entry and Edit on GitHub opens the lane’s steer.md', async ({ page }) => {
  const errors: string[] = [];
  // The 404s from /api/health and live.json are how the page learns it is the snapshot demo (stubbed above), not errors.
  page.on('console', (m) => { if (m.type() === 'error' && !/\/api\/health|\/live\.json/.test(m.location().url)) errors.push(`${m.text()} ${m.location().url}`); });
  page.on('pageerror', (e) => errors.push(e.message));
  await serve(page, { demo: true });
  await page.goto('/#/loop/self');
  await page.getByRole('button', { name: 'Steer', exact: true }).click();
  const dialog = page.getByTestId('steer-dialog');
  await expect(dialog.getByRole('button', { name: 'Edit on GitHub' })).toBeDisabled();
  await dialog.getByLabel('Lane', { exact: true }).selectOption('web');
  await dialog.getByLabel('Unit (optional)').fill('4');
  await dialog.getByRole('radio', { name: 'Standing' }).check();
  await dialog.getByLabel('Tell the lane what to do, in plain words').fill('Ship the legend before the grid.');
  await expect(dialog.getByTestId('steer-preview')).toHaveText('## 2026-10-13 14:05 UTC · owner · standing\nUnit 4: Ship the legend before the grid.\n');
  await expect(dialog).toContainText('.ai/lanes/web/steer.md');
  await expect(dialog.getByTestId('steer-create')).toHaveAttribute('href', /^https:\/\/github\.com\/o\/r\/new\/main\?filename=\.ai%2Flanes%2Fweb%2Fsteer\.md&value=%23%23%202026-10-13%2014%3A05%20UTC/);
  await dialog.getByRole('button', { name: 'Edit on GitHub' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { opened: string[] }).opened)).toEqual(['https://github.com/o/r/edit/main/.ai/lanes/web/steer.md']);
  await expect(dialog.getByTestId('steer-note')).toBeVisible();
  expect(errors).toEqual([]);
});

test('a lane row opens the composer for that lane, and S opens it from the page', async ({ page }) => {
  await serve(page, { demo: true });
  await page.goto('/#/loop/self');
  await page.getByRole('tab', { name: 'Lanes' }).click();
  await page.getByRole('button', { name: 'Steer web' }).click();
  await expect(page.getByTestId('steer-dialog').getByLabel('Lane', { exact: true })).toHaveValue('web');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('steer-dialog')).toHaveCount(0);
  await page.keyboard.press('s');
  await expect(page.getByTestId('steer-dialog').getByLabel('Lane', { exact: true })).toHaveValue('core');
  // Typing an "s" inside the dialog is text, not a second shortcut.
  await page.getByTestId('steer-dialog').getByLabel('Tell the lane what to do, in plain words').pressSequentially('ss');
  await expect(page.getByTestId('steer-dialog')).toHaveCount(1);
});

test('local: the composer offers the loop steer command', async ({ page }) => {
  await serve(page, { demo: false });
  await page.goto('/#/loop/self');
  await page.getByRole('button', { name: 'Steer', exact: true }).click();
  const dialog = page.getByTestId('steer-dialog');
  await dialog.getByLabel('Tell the lane what to do, in plain words').fill('Fix "the strip"');
  await expect(dialog.getByTestId('steer-command')).toHaveText("npx compounding-loop steer -- core 'Fix \"the strip\"'");
  await expect(dialog.getByRole('button', { name: 'Copy command' })).toBeEnabled();
});

for (const theme of ['light', 'dark'] as const) {
  test(`axe: the steer composer in the ${theme} theme`, async ({ page }) => {
    await page.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch { /* blocked */ } }, theme);
    await serve(page, { demo: true });
    await page.goto('/#/loop/self');
    await page.getByRole('button', { name: 'Steer', exact: true }).click();
    await page.getByTestId('steer-dialog').getByLabel('Tell the lane what to do, in plain words').fill('Go');
    const { violations } = await new AxeBuilder({ page }).include('[data-testid="steer-dialog"]').analyze();
    expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
