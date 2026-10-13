import { expect, test } from '@playwright/test';

// `loop dashboard --demo`: a server answers, but /api/health says `demo: true` and every write route answers 409.
// The write controls must take the demo path (GitHub links), never a local Save that can only fail.
const lane = (name: string) => ({ name, state: 'building', run: 3, limit: 20, locked: false, unanswered: [] });
const LOOP = {
  id: 'self', name: 'self', state: 'building', reason: 'Building', repoUrl: 'https://github.com/o/r', round: 5, roundsTotal: 5, run: 0, runLimit: 0,
  lanes: ['core', 'web'].map(lane), timeline: [], contract: [], knowledge: [], decisions: [],
  pace: { pace: 'balanced', overrides: {} },
};

test('demo server: Pace, Steer and Pause open GitHub instead of posting to the read-only server', async ({ page }) => {
  const posts: string[] = [];
  await page.route('**/api/**', (r) => {
    if (r.request().method() !== 'GET') { posts.push(r.request().url()); return r.fulfill({ status: 409, json: { error: 'demo is read-only' } }); }
    return r.fallback();
  });
  await page.route('**/api/health', (r) => r.fulfill({ json: { ok: true, version: '0.0.0', demo: true } }));
  await page.route('**/api/loops', (r) => r.fulfill({ json: [LOOP] }));
  await page.route('**/api/loops/self', (r) => r.fulfill({ json: LOOP }));
  await page.route('**/api/inbox', (r) => r.fulfill({ json: [] }));
  await page.goto('/#/loop/self');
  await page.getByRole('tab', { name: 'Lanes' }).click();

  const block = page.getByTestId('pace-block');
  await block.getByRole('button', { name: 'Change pace' }).click();
  await expect(block.getByTestId('pace-edit')).toBeVisible();
  await expect(block.getByRole('button', { name: /^Save/ })).toHaveCount(0);

  await page.getByTestId('control-bar').getByRole('button', { name: 'Steer' }).click();
  const steer = page.getByRole('dialog');
  await expect(steer.getByRole('button', { name: 'Edit on GitHub' })).toBeVisible();
  await expect(steer.getByRole('button', { name: 'Save' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(steer).toHaveCount(0);

  await page.getByTestId('control-bar').getByRole('button', { name: 'Pause all' }).click();
  await expect(page.getByRole('dialog')).toContainText('Nothing is sent from this dashboard.');
  expect(posts).toEqual([]);
});
