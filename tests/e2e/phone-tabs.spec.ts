import { expect, test, type Locator } from '@playwright/test';

// Round 5 A6: at 375 px the tab rows scroll sideways inside themselves; a cut label always comes with an edge fade and the active tab is in view.
test.use({ viewport: { width: 375, height: 760 } });

async function fullyInside(item: Locator, row: Locator): Promise<boolean> {
  const [a, b] = await Promise.all([item.boundingBox(), row.boundingBox()]);
  return !!a && !!b && a.x >= b.x - 0.5 && a.x + a.width <= b.x + b.width + 0.5;
}

async function cutWithoutFade(row: Locator): Promise<string[]> {
  return row.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const mask = getComputedStyle(el).maskImage || getComputedStyle(el).getPropertyValue('-webkit-mask-image');
    const faded = !!mask && mask !== 'none';
    return [...el.children].filter((c) => {
      const r = c.getBoundingClientRect();
      return (r.left < box.left - 0.5 || r.right > box.right + 0.5) && !faded;
    }).map((c) => c.textContent ?? '');
  });
}

test('the main nav keeps the active page in view and fades where labels are cut', async ({ page }) => {
  await page.goto('/#/settings');
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
  // The Inbox badge can arrive after the first paint and widen the row, so wait for the row to settle.
  await expect.poll(() => fullyInside(nav.getByRole('link', { name: 'Settings' }), nav)).toBe(true);
  await expect.poll(() => cutWithoutFade(nav)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('the loop tab bar scrolls the chosen tab into view and fades where labels are cut', async ({ page }) => {
  await page.goto('/#/loop/compounding-loop');
  const tabs = page.getByRole('tablist', { name: 'Loop sections' });
  await expect(tabs.getByRole('tab').first()).toBeVisible();
  await expect.poll(() => cutWithoutFade(tabs)).toEqual([]);
  const last = tabs.getByRole('tab').last();
  await last.focus();
  await last.click();
  await expect(last).toHaveAttribute('aria-selected', 'true');
  await expect.poll(() => fullyInside(last, tabs)).toBe(true);
  await expect.poll(() => cutWithoutFade(tabs)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
