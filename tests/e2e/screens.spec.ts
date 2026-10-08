import { expect, test, type Page } from '@playwright/test';

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test('loop detail has the five tabs and the contract passes', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/#/loop/proj2');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('proj2');
  for (const t of ['Timeline', 'Contract', 'Knowledge', 'Decisions', 'Settings']) {
    await page.getByRole('tab', { name: t }).click();
    await expect(page.getByRole('tab', { name: t })).toHaveAttribute('aria-selected', 'true');
  }
  await page.getByRole('tab', { name: 'Contract' }).click();
  await expect(page.getByLabel('Passes').first()).toBeVisible();
  await expect(page.getByLabel('Fails')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('unknown loop says so', async ({ page }) => {
  await page.goto('/#/loop/nope');
  await expect(page.getByRole('alert')).toContainText('No loop called');
});

test('health lists the demo checks as passing', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/#/health');
  await expect(page.getByRole('list', { name: 'Health checks' }).getByRole('listitem')).toHaveCount(10);
  await expect(page.getByText('Failing', { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('settings changes the theme', async ({ page }) => {
  await page.goto('/#/settings');
  await page.getByLabel('Light').check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('inbox: empty state in demo; a question can be accepted with j/k/a and the demo refuses writes', async ({ page, isMobile }) => {
  await page.goto('/#/inbox');
  await expect(page.getByText('Inbox empty')).toBeVisible();

  const item = (loopId: string) => ({ loopId, file: 'BLOCKED.md', question: `Question for ${loopId}?`, bestGuess: 'Use blue.', since: '2026-10-08T01:00:00Z' });
  await page.route('**/api/inbox', (r) => r.fulfill({ json: [item('alpha'), item('beta')] }));
  let posted = '';
  await page.route('**/api/loops/*/answer', (r) => { posted = `${r.request().url()} ${r.request().postData()}`; return r.fulfill({ status: 409, json: { error: 'demo is read-only' } }); });
  await page.reload();
  await expect(page.getByLabel('Questions').getByRole('listitem')).toHaveCount(2);
  await expect(page.getByLabel(/Your answer/).first()).toHaveValue('Use blue.');
  test.skip(isMobile, 'shortcuts are keyboard only');
  await page.keyboard.press('j');
  await page.keyboard.press('a');
  await expect(page.getByRole('alert')).toHaveText('demo is read-only');
  expect(posted).toContain('/api/loops/beta/answer');
  expect(posted).toContain('Use blue.');
});

test('fleet shows "needs you" when the inbox has questions', async ({ page }) => {
  await page.route('**/api/inbox', (r) => r.fulfill({ json: [{ loopId: 'a', file: 'BLOCKED.md', question: 'q', bestGuess: 'g', since: '2026-10-08T01:00:00Z' }] }));
  await page.goto('/');
  await expect(page.getByRole('link', { name: /1 thing needs you/ })).toBeVisible();
});
