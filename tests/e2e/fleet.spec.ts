import { expect, test, type Page } from '@playwright/test';

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

const SITES: [string, number][] = [
  ['powerstationruntime.netlify.app', 278], ['clearpoolmath.netlify.app', 543], ['yarnsums.netlify.app', 419],
  ['quiltcalculators.netlify.app', 452], ['mathtank.netlify.app', 433],
];

test('fleet shows the five demo sites with their numbers and "Nothing needs you"', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await expect(page.getByText('Nothing needs you')).toBeVisible();
  const cards = page.getByTestId('loop-card');
  await expect(cards).toHaveCount(5);
  for (const [name, passed] of SITES) {
    const card = cards.filter({ hasText: name });
    await expect(card).toContainText('Done');
    await expect(card).toContainText('5/5');
    await expect(card).toContainText('0/30');
    await expect(card).toContainText(`${passed} passed`);
  }
  expect(errors).toEqual([]);
});

test('no horizontal scroll at 375px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto('/');
  await expect(page.getByTestId('loop-card').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('theme toggle switches and persists the theme', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');
  const before = await html.getAttribute('data-theme');
  await page.getByRole('button', { name: /Switch to (light|dark) theme/ }).click();
  const after = await html.getAttribute('data-theme');
  expect(after).not.toBe(before);
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', after!);
});

test('keyboard: tab reaches nav and cards with visible focus; Ctrl+K palette navigates', async ({ page, isMobile }) => {
  await page.goto('/');
  await expect(page.getByTestId('loop-card')).toHaveCount(5);
  // Tab through the whole page: every stop must show a focus outline, and a loop card must be reachable.
  let reachedCard = false;
  for (let i = 0; i < 15 && !reachedCard; i++) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      return { card: el.dataset.testid === 'loop-card', outline: getComputedStyle(el).outlineStyle };
    });
    expect(stop.outline).not.toBe('none');
    reachedCard = stop.card;
  }
  expect(reachedCard).toBe(true);
  test.skip(isMobile, 'no keyboard shortcuts on touch');
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox').fill('health');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/health/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Health');
});
