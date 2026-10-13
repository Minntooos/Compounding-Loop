import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { writableServer } from './writable';

// Round 5 C9: the Pace control on the Lanes tab: the loop's pace, each lane's override, four presets with what they skip.
const lane = (name: string) => ({ name, state: 'building', run: 3, limit: 20, locked: false, unanswered: [] });
const LOOP = {
  id: 'self', name: 'self', state: 'building', reason: 'Building', repoUrl: 'https://github.com/o/r', round: 5, roundsTotal: 5, run: 0, runLimit: 0,
  lanes: ['core', 'web'].map(lane), timeline: [], contract: [], knowledge: [], decisions: [],
  pace: { pace: 'balanced', overrides: { web: 'careful' }, note: 'control room set web to careful: CI red twice in 24 h' },
};

const row = (page: Page, name: string) => page.getByTestId('lane-row').filter({ has: page.getByRole('heading', { name, exact: true }) });

async function serveDemo(page: Page) {
  await page.route('**/api/health', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await page.route('**/live.json', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/loops.json', (r) => r.fulfill({ json: [LOOP] }));
  await page.route('**/api/loops/self.json', (r) => r.fulfill({ json: LOOP }));
  await page.route('**/api/inbox.json', (r) => r.fulfill({ json: [] }));
  await page.goto('/#/loop/self');
  await page.getByRole('tab', { name: 'Lanes' }).click();
}

test('the Lanes tab states the loop pace and a lane override; the chooser shows every preset with what it skips', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/\/api\/health|\/live\.json/.test(m.location().url)) errors.push(m.text()); });
  await serveDemo(page);
  const block = page.getByTestId('pace-block');
  await expect(block.getByRole('heading', { name: 'Pace: Balanced' })).toBeVisible();
  await expect(block).toContainText('one reviewer per run');
  await expect(block.getByTestId('pace-note')).toHaveText('Why this pace: control room set web to careful: CI red twice in 24 h');
  await expect(row(page, 'web').getByTestId('lane-pace')).toHaveText('Pace: Careful (own)');
  await expect(row(page, 'core').getByTestId('lane-pace')).toHaveCount(0);
  await block.getByRole('button', { name: 'Change pace' }).click();
  const group = block.getByRole('group', { name: 'Pace for every lane' });
  await expect(group.getByRole('radio')).toHaveCount(4);
  await expect(group.getByRole('radio', { name: /Balanced/ })).toBeChecked();
  await expect(group.getByRole('radio', { name: /Balanced/ })).toBeFocused();
  for (const word of ['Careful', 'Fast', 'Sprint']) await expect(group.getByRole('radio', { name: new RegExp(word) })).toBeVisible();
  await expect(group).toContainText('no reviewer');
  await expect(block).toContainText('never push with a failing check');
  await expect(block.getByTestId('pace-note-clears')).toHaveText('A new pace clears the “Why this pace” note.');
  expect(errors).toEqual([]);
});

test('demo: a lane pace opens policy.json on GitHub and shows the whole new file', async ({ page }) => {
  await serveDemo(page);
  const opened: string[] = [];
  await page.exposeFunction('recordOpen', (url: string) => { opened.push(url); });
  await page.evaluate(() => { window.open = ((url: string) => { void (window as unknown as { recordOpen: (u: string) => void }).recordOpen(String(url)); return null; }) as typeof window.open; });
  await row(page, 'core').getByRole('button', { name: 'Pace of core' }).click();
  const chooser = row(page, 'core').getByTestId('pace-chooser');
  await expect(chooser.getByRole('group', { name: 'Pace for core' })).toBeVisible();
  await expect(chooser.getByTestId('pace-edit')).toBeDisabled();
  await chooser.getByRole('radio', { name: /Sprint/ }).check();
  await expect(chooser.getByTestId('pace-file')).toContainText('"core": {"pace":"sprint"}');
  await expect(chooser.getByTestId('pace-file')).toContainText('"web": {"pace":"careful"}');
  await chooser.getByTestId('pace-edit').click();
  await expect.poll(() => opened).toEqual(['https://github.com/o/r/edit/main/.ai/policy.json']);
  await expect(chooser.getByRole('status')).toContainText('paste');
  await expect(chooser.getByRole('status')).toContainText('other lanes');
  await chooser.getByRole('radio', { name: /Sprint/ }).press('Escape');
  await expect(chooser).toHaveCount(0);
  await expect(row(page, 'core').getByRole('button', { name: 'Pace of core' })).toBeFocused();
});

test('local: Save pace posts the loop pace or one lane, toasts, and keeps an error on the chooser', async ({ page }) => {
  await writableServer(page);
  await page.route('**/api/loops', (r) => r.fulfill({ json: [LOOP] }));
  await page.route('**/api/loops/self', (r) => r.fulfill({ json: LOOP }));
  await page.route('**/api/inbox', (r) => r.fulfill({ json: [] }));
  const posted: unknown[] = [];
  await page.route('**/api/loops/self/pace', (r) => {
    const body = r.request().postDataJSON() as { pace: string; lane?: string };
    posted.push(body);
    return body.lane === 'web' ? r.fulfill({ status: 422, json: { error: 'git commit failed' } }) : r.fulfill({ json: { ok: true, changed: true, lanes: ['all'], pushed: true } });
  });
  await page.goto('/#/loop/self');
  await page.getByRole('tab', { name: 'Lanes' }).click();
  const block = page.getByTestId('pace-block');
  await block.getByRole('button', { name: 'Change pace' }).click();
  await expect(block.getByTestId('pace-save')).toBeDisabled();
  await block.getByRole('radio', { name: /Fast/ }).check();
  await block.getByTestId('pace-save').click();
  await expect(page.getByText("Loop pace is now fast, from each lane's next run")).toBeVisible();
  await expect(block.getByTestId('pace-chooser')).toHaveCount(0);
  await row(page, 'web').getByRole('button', { name: 'Pace of web' }).click();
  const chooser = row(page, 'web').getByTestId('pace-chooser');
  await expect(chooser.getByRole('radio', { name: /Careful/ })).toBeChecked();
  await expect(chooser.getByRole('radio', { name: /Balanced/ })).toHaveAccessibleName(/the loop’s pace/);
  await chooser.getByRole('radio', { name: /Balanced/ }).check();
  await chooser.getByTestId('pace-save').click();
  await expect(chooser.getByTestId('pace-error')).toHaveText('git commit failed');
  expect(posted).toEqual([{ pace: 'fast' }, { pace: 'balanced', lane: 'web' }]);
});

for (const theme of ['light', 'dark'] as const) {
  test(`axe: the open Pace chooser in the ${theme} theme`, async ({ page }) => {
    await page.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch { /* blocked */ } }, theme);
    await serveDemo(page);
    await page.getByTestId('pace-block').getByRole('button', { name: 'Change pace' }).click();
    await page.getByTestId('pace-block').getByRole('radio', { name: /Sprint/ }).check();
    const res = await new AxeBuilder({ page }).analyze();
    expect(res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
