import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Round 5 A3: Health has three states; a check that was never measured is grey "Not checked", never "OK".
const CHECKS = [
  { loopId: 'site', kind: 'failing-tests', ok: true, state: 'unchecked', label: 'Not checked', reason: 'no test result recorded yet', proof: '.ai/last-test.json not found', howToCheck: 'Run `npm test` with the template script and commit .ai/last-test.json' },
  { loopId: 'site', kind: 'leak', ok: true, state: 'pass', label: 'No leaked text on the live site', reason: 'no leaked strings', proof: 'GET https://example.org returned 200' },
  { loopId: 'site', kind: 'short-runs', ok: false, state: 'fail', label: 'Runs ending too fast', reason: '3 runs under a minute', proof: '.ai/runs.jsonl' },
];

test.beforeEach(async ({ page }) => {
  // Static fixture, never route.fetch (see cockpit.spec.ts).
  await page.route('**/api/checks', (route) => route.fulfill({ json: CHECKS }));
});

test('an unmeasured check reads Not checked with how to check it, and is not counted as a pass', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/#/health');
  const rows = page.getByRole('list', { name: 'Health checks' }).getByRole('listitem');
  await expect(rows).toHaveCount(3);
  const unchecked = rows.nth(0);
  await expect(unchecked).toHaveAttribute('data-state', 'unchecked');
  await expect(unchecked).toContainText('Not checked');
  await expect(unchecked).toContainText('Test results');
  await expect(unchecked).not.toContainText('OK');
  await expect(unchecked).not.toContainText('Tests pass');
  await expect(unchecked.locator('code', { hasText: 'npm test' })).toBeVisible();
  await expect(rows.nth(1)).toContainText('Pass');
  await expect(rows.nth(2)).toContainText('Fail');
  await expect(page.getByTestId('health-summary')).toHaveText('1 failing · 1 passing · 1 not checked');
  await expect(page.getByText('OK', { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a long proof wraps between words at 375 px, splitting only a word too long for the line', async ({ page }) => {
  const proof = 'GET https://quiltcalculators-and-more.netlify.app returned 200';
  await page.route('**/api/checks', (route) => route.fulfill({ json: [{ ...CHECKS[1], proof }] }));
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/#/health');
  const code = page.getByRole('list', { name: 'Health checks' }).locator('code', { hasText: 'returned' });
  await expect(code).toHaveText(proof);
  // Try hosts of every length from 10 to 40 characters, so some line end always falls inside "returned" or "200"
  // under character-level breaking ("ret / urned" and "20 / 0" were the bug). One client rect per word = one line.
  const split = await code.evaluate((el) => {
    const bad: string[] = [];
    for (let n = 10; n <= 40; n++) {
      el.textContent = `GET https://${'q'.repeat(n)}.netlify.app returned 200`;
      const text = el.firstChild as Text;
      for (const word of ['returned', '200']) {
        const range = document.createRange();
        const at = text.data.lastIndexOf(word);
        range.setStart(text, at); range.setEnd(text, at + word.length);
        if (range.getClientRects().length > 1) bad.push(`${n}: ${word}`);
      }
    }
    return bad;
  });
  expect(split).toEqual([]);
});

for (const theme of ['light', 'dark'] as const) {
  test(`axe: Health with all three states in the ${theme} theme`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
    await page.goto('/#/health');
    await expect(page.getByTestId('health-summary')).toBeVisible();
    const res = await new AxeBuilder({ page }).analyze();
    expect(res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
  });
}
