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

test('settings shows the server settings; the demo reveals no local folder or account', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/#/settings');
  const list = page.getByRole('list', { name: 'Server settings' }).or(page.getByLabel('Server settings'));
  await expect(list).toContainText('Claude Code routine');
  await expect(list).toContainText('none (demo)');

  await page.route('**/api/settings', (r) => r.fulfill({ json: { demo: false, projectsDir: '/home/ana/loops', ghAccount: 'ana', defaultRunner: 'local' } }));
  await page.reload();
  await expect(list).toContainText('/home/ana/loops');
  await expect(list).toContainText('ana');
  await expect(list).toContainText('Local loop');
  expect(errors).toEqual([]);
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

test('wizard: live brief score, template, runner and the exact command', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/#/new');
  await expect(page.getByTestId('brief-score')).toContainText('Brief score 0/100');
  await page.getByLabel(/^Brief/).fill([
    '# Quilt calculators', 'A one-line pitch: calculators for quilters.', '## Audience', 'Hobby quilters who plan fabric purchases.',
    '## Must have', '- Backing fabric calculator', '- Binding length calculator', '- Batting size chooser',
    '## Done when', '- npm test passes and every calculator has a worked example', '## Out of scope', '- Accounts, payments, analytics',
  ].join('\n'));
  const score = await page.getByTestId('brief-score').textContent();
  expect(Number(/score (\d+)/.exec(score ?? '')?.[1])).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Chrome extension').check();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('GitHub Actions').check();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Name').fill('My Quilt Site!');
  await expect(page.getByTestId('new-command')).toHaveText('npx compounding-loop new chrome-extension my-quilt-site');
  expect(errors).toEqual([]);
});

test('empty fleet offers to create the first loop', async ({ page }) => {
  await page.route('**/api/loops', (r) => r.fulfill({ json: [] }));
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Create your first loop' })).toBeVisible();
});

function luminance([r, g, b]: number[]): number {
  const f = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
}

for (const theme of ['dark', 'light']) {
  test(`WCAG AA contrast of status and muted text in the ${theme} theme`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
    await page.goto('/');
    await expect(page.getByTestId('loop-card').first()).toBeVisible();
    const pairs = await page.evaluate(() => {
      const probe = document.createElement('span');
      document.body.append(probe);
      const rgb = (v: string) => { probe.style.color = v; return getComputedStyle(probe).color.match(/\d+/g)!.slice(0, 3).map(Number); };
      const cs = getComputedStyle(document.documentElement);
      const tokens = ['--text', '--muted', '--done', '--blocked', '--failing', '--building'];
      return { bg: rgb(cs.getPropertyValue('--bg')), surface: rgb(cs.getPropertyValue('--surface')), fg: tokens.map((t) => [t, rgb(cs.getPropertyValue(t))] as const) };
    });
    for (const [token, color] of pairs.fg) {
      for (const bg of [pairs.bg, pairs.surface]) {
        const [hi, lo] = [luminance(color), luminance(bg)].sort((a, b) => b - a);
        expect((hi! + 0.05) / (lo! + 0.05), `${token} on ${bg} in ${theme}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
}

test('loop tabs move with the arrow keys', async ({ page }) => {
  await page.goto('/#/loop/proj1');
  await page.getByRole('tab', { name: 'Timeline' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Contract' })).toBeFocused();
  await expect(page.getByRole('tab', { name: 'Contract' })).toHaveAttribute('aria-selected', 'true');
});

test('a failed load shows an error with a working retry', async ({ page }) => {
  let fail = true;
  await page.route('**/api/loops', (route) => (fail ? route.fulfill({ status: 500, body: 'boom' }) : route.continue()));
  await page.goto('/');
  const alert = page.getByRole('alert').filter({ hasText: 'Could not load the fleet' });
  await expect(alert).toBeVisible();
  fail = false;
  await alert.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('Could not load the fleet')).toHaveCount(0);
  await expect(page.getByText('Nothing needs you')).toBeVisible();
});

for (const [route, hash, what] of [
  ['**/api/checks', '/#/health', 'the checks'],
  ['**/api/inbox', '/#/inbox', 'the inbox'],
  ['**/api/loops/proj1', '/#/loop/proj1', 'this loop'],
] as const) {
  test(`a failed load of ${what} shows an error with a working retry`, async ({ page }) => {
    let fail = true;
    await page.route(route, (r) => (fail ? r.fulfill({ status: 500, body: 'boom' }) : r.continue()));
    await page.goto(hash);
    const alert = page.getByRole('alert').filter({ hasText: `Could not load ${what}` });
    await expect(alert).toBeVisible();
    fail = false;
    await alert.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByText(`Could not load ${what}`)).toHaveCount(0);
  });
}
