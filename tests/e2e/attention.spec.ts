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

test('the Inbox lists what the badge counts: a stalled lane gets a row, not "Inbox empty"', async ({ page }) => {
  await page.route('**/api/loops', async (route) => {
    const res = await route.fetch();
    const loops = (await res.json()) as Record<string, unknown>[];
    await route.fulfill({ response: res, json: [{ ...loops[0], id: 'laned', name: 'laned-loop', state: 'building', lanes: [{ name: 'web', state: 'stalled', run: 3, limit: 20, locked: false, unanswered: [] }] }] });
  });
  await page.route('**/api/inbox', (route) => route.fulfill({ json: [] }));
  await page.goto('/#/inbox');
  await expect(page.getByTestId('nav-attention')).toHaveText('1');
  await expect(page.getByTestId('attention-row')).toHaveCount(1);
  await expect(page.getByTestId('attention-row')).toContainText('Lane web is stalled');
  await expect(page.getByText(/Inbox empty/)).toHaveCount(0);
});

test('"Routines look off" gets one Needs-you row, a Stalled strip and the badge count, not one row per stalled lane', async ({ page }) => {
  const lane = (name: string) => ({ name, state: 'stalled', run: 3, limit: 20, locked: false, unanswered: [] });
  // Static fixtures, never route.fetch (see cockpit.spec.ts).
  const off = {
    id: 'off', name: 'off-loop', state: 'building', reason: 'Building', round: 5, roundsTotal: 5, run: 0, runLimit: 0, repoUrl: 'https://github.com/o/r',
    lanes: [lane('web'), lane('core')], runOutcomes: { limitStops5h: 0, running: [], sleeping: [], routinesLookOff: true },
  };
  await page.route('**/api/loops', (route) => route.fulfill({ json: [off] }));
  // The server also reports the silence as lanes not running (blaming the usage limit); "Routines look off" replaces it.
  const silent = { loopId: 'off', kind: 'lanes-not-running', file: '.ai/lanes.json', question: 'Lanes are not running: web (6 missed). Check your plan\'s usage limit.', bestGuess: '', since: '2026-10-13T00:00:00Z' };
  await page.route('**/api/inbox', (route) => route.fulfill({ json: [silent] }));
  await page.goto('/');
  await expect(page.getByTestId('nav-attention')).toHaveText('1');
  await expect(page.getByTestId('status-strip').locator('[data-segment="state"]')).toHaveText('Stalled', { useInnerText: true });
  const row = page.getByTestId('attention-row');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Routines look off');
  await expect(row).toHaveAttribute('data-group', 'stalled');
  await page.goto('/#/inbox');
  await expect(page.getByTestId('attention-row')).toContainText('Routines look off');
  await expect(page.getByText(/Lanes are not running/)).toHaveCount(0);
});
