import { expect, test, type Page } from '@playwright/test';

// Round 5 A1 + A4: one attention list feeds the fleet banner and the Inbox badge; a shipped release leaves it.
const RELEASE = { loopId: 'laned', kind: 'release', file: 'DONE.md', question: 'Round 4 is done: release 0.4.0', bestGuess: '', since: '2026-10-12T22:00:00Z' };

async function serve(page: Page, opts: { shipped: boolean }) {
  await page.route('**/api/loops', async (route) => {
    const res = await route.fetch();
    const loops = (await res.json()) as Record<string, unknown>[];
    const laned = {
      ...loops[0], id: 'laned', name: 'laned-loop', state: 'done', reason: 'Round 4 done', round: 4, roundsTotal: 4,
      lanes: [{ name: 'web', state: 'done', run: 3, limit: 20, locked: false, unanswered: [] }],
      ...(opts.shipped ? { shipped: { version: '0.4.0', date: '2026-10-13T00:40:00Z', npm: 'latest' } } : {}),
    };
    // Only the laned loop, so the counts below belong to it alone.
    await route.fulfill({ response: res, json: [laned] });
  });
  await page.route('**/api/inbox', (route) => route.fulfill({ json: opts.shipped ? [] : [RELEASE] }));
}

test('a waiting release is counted once: the banner and the Inbox badge agree', async ({ page }) => {
  await serve(page, { shipped: false });
  await page.goto('/');
  await expect(page.getByRole('link', { name: /1 thing needs you/ })).toBeVisible();
  await expect(page.getByTestId('nav-attention')).toHaveText('1');
});

test('a shipped release says "released" and leaves the attention list', async ({ page }) => {
  await serve(page, { shipped: true });
  await page.goto('/');
  await expect(page.getByText('Nothing needs you')).toBeVisible();
  await expect(page.getByTestId('nav-attention')).toHaveCount(0);
  await expect(page.getByTestId('loop-card')).toContainText('0.4.0 released 13 Oct');
});
