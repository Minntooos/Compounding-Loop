import { expect, test } from '@playwright/test';

// Commits per day on the Timeline tab: the first and last day are labelled, and the bars run edge to edge so the labels sit under them.
const commit = (sha: string, at: string) => ({ sha, at, message: `web: change ${sha}`, lane: 'web' });
const LOOP = {
  id: 'self', name: 'self', state: 'building', reason: 'Building', round: 5, roundsTotal: 5, run: 0, runLimit: 0,
  timeline: [commit('c3', '2026-10-13T10:00:00Z'), commit('c2', '2026-10-13T09:00:00Z'), commit('c1', '2026-10-11T08:00:00Z')],
  contract: [], knowledge: [], decisions: [],
};

test('commits per day names its first and last day under bars that span the chart', async ({ page }) => {
  await page.route('**/api/health', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await page.route('**/live.json', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/loops.json', (r) => r.fulfill({ json: [LOOP] }));
  await page.route('**/api/loops/self.json', (r) => r.fulfill({ json: LOOP }));
  await page.route('**/api/inbox.json', (r) => r.fulfill({ json: [] }));
  await page.goto('/#/loop/self');
  const chart = page.getByTestId('activity-chart');
  await expect(chart.locator('figcaption')).toHaveText('Commits per day (UTC) · busiest 2');
  await expect(chart.getByTestId('activity-axis').locator('span')).toHaveText(['Sun 11 Oct', 'Tue 13 Oct']);
  const figure = await chart.boundingBox();
  const bars = await chart.locator('rect').evaluateAll((rects) => rects.map((r) => r.getBoundingClientRect()).map((b) => ({ left: b.left, right: b.right })));
  // 12 px padding on each side of the figure; the outer bars reach within a few pixels of it.
  expect(bars[0]!.left - figure!.x).toBeLessThan(20);
  expect(figure!.x + figure!.width - bars[bars.length - 1]!.right).toBeLessThan(20);
});
