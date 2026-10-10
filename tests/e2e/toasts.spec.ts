import { expect, test } from '@playwright/test';

test('server events show a polite toast that goes away', async ({ page }) => {
  // The demo server only sends `ready`, so drive the listeners by hand.
  await page.addInitScript(() => {
    class FakeEventSource {
      listeners: Record<string, (() => void)[]> = {};
      constructor() { (window as unknown as { fakeEs: FakeEventSource }).fakeEs = this; }
      addEventListener(type: string, fn: () => void) { (this.listeners[type] ??= []).push(fn); }
      close() { /* nothing to close */ }
      emit(type: string) { this.listeners[type]?.forEach((fn) => fn()); }
    }
    (window as unknown as { EventSource: unknown }).EventSource = FakeEventSource;
  });
  await page.goto('/');
  await expect(page.getByTestId('loop-card').first()).toBeVisible();
  await page.waitForFunction(() => Boolean((window as unknown as { fakeEs?: unknown }).fakeEs));
  await page.evaluate(() => (window as unknown as { fakeEs: { emit(t: string): void } }).fakeEs.emit('inbox-changed'));
  const toast = page.getByTestId('toast');
  await expect(toast).toHaveText('Your inbox changed');
  await expect(page.getByRole('status').filter({ has: toast })).toHaveAttribute('aria-live', 'polite');
  await expect(toast).toHaveCount(0, { timeout: 8_000 });
});
