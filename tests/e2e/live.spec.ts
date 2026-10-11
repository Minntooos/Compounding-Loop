import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Demo mode (no dashboard server) plus a live.json and a mocked GitHub: no real network is touched.
async function mockLive(page: Page, github: 'ok' | 'rate-limited' | 'down') {
  await page.route('**/api/health', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  // Pages serves the page with a CSP meta tag that allows GitHub; the local server's header does not, so widen it here the same way.
  await page.route((url) => url.pathname === '/', async (route) => {
    const res = await route.fetch();
    const csp = (res.headers()['content-security-policy'] ?? '').replace("connect-src 'self'", "connect-src 'self' https://api.github.com https://raw.githubusercontent.com");
    await route.fulfill({ response: res, headers: { ...res.headers(), 'content-security-policy': csp } });
  });
  await page.route('**/live.json', (route) => route.fulfill({ json: { repo: 'Minntooos/Compounding-Loop', loop: 'compounding-loop' } }));
  await page.route('https://api.github.com/**', (route) => {
    if (github === 'rate-limited') return route.fulfill({ status: 403, headers: { 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 1800) }, json: { message: 'rate limit exceeded' } });
    if (github === 'down') return route.abort();
    if (route.request().url().includes('/git/trees/')) return route.fulfill({ json: { tree: [{ path: '.ai/task.md' }] } });
    if (route.request().url().includes('/actions/runs')) return route.fulfill({ json: { workflow_runs: [] } });
    return route.fulfill({ json: [{ sha: 'f'.repeat(40), commit: { message: 'web: live mocked commit\n\nLane: web', committer: { date: new Date().toISOString() } } }] });
  });
  await page.route('https://raw.githubusercontent.com/**', (route) => {
    const url = route.request().url();
    if (url.endsWith('/.ai/task.md')) return route.fulfill({ body: '# Task\nRun: 7 / 20\n' });
    return route.fulfill({ status: 404, body: 'Not Found' });
  });
}

test('live mode: the header says Live and the fleet shows the mocked GitHub state', async ({ page }) => {
  // Absent files must never be requested: each 404 is a red line in the console.
  const misses: string[] = [];
  page.on('response', (r) => { if (r.status() === 404 && !r.url().startsWith('http://localhost')) misses.push(r.url()); });
  await mockLive(page, 'ok');
  await page.goto('/#/');
  await expect(page.getByRole('status').filter({ hasText: /^Live · updated \d\d:\d\d UTC$/ })).toBeVisible();
  const card = page.getByRole('link', { name: /compounding-loop/ }).first();
  await expect(card).toContainText('7 of 20 runs');
  await card.click();
  await expect(page.getByText('live mocked commit').first()).toBeVisible();
  expect(misses).toEqual([]);
});

test('rate limited: falls back to the snapshot with a calm explanation', async ({ page }) => {
  await mockLive(page, 'rate-limited');
  await page.goto('/#/');
  await expect(page.getByRole('status').filter({ hasText: /anonymous limit was reached/ })).toBeVisible();
  await expect(page.getByRole('note').filter({ hasText: /Live view paused/ })).toBeVisible();
  await expect(page.getByTestId('loop-card').first()).toBeVisible();
  await expect(page.getByText('live mocked commit')).toHaveCount(0);
});

test('GitHub unreachable: the snapshot shows with no error screen', async ({ page }) => {
  await mockLive(page, 'down');
  await page.goto('/#/');
  await expect(page.getByRole('status').filter({ hasText: /^Snapshot from \d+ \w{3}$/ })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

for (const scheme of ['light', 'dark'] as const) {
  test(`axe: live fleet in the ${scheme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await mockLive(page, 'ok');
    await page.goto('/#/');
    await expect(page.getByRole('status').filter({ hasText: /^Live/ })).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
}
