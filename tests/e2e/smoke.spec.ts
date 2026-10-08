import { expect, test } from '@playwright/test';

test('dashboard shell loads without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Compounding Loop');
  expect(errors).toEqual([]);
});
