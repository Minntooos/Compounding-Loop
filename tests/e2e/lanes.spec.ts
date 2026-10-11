import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const lane = (name: string, state: string, extra: object = {}) => ({
  name, state, run: 7, limit: 30, locked: state === 'building', unanswered: [],
  lastCommit: { sha: 'abcdef1234567', subject: `${name}: ship the thing`, at: new Date(Date.now() - 3_600_000).toISOString() }, ...extra,
});
const LANES = [
  lane('core', 'done'),
  lane('server', 'building'),
  lane('web', 'stalled', { unanswered: [{ from: 'web', to: 'server', at: new Date().toISOString(), text: 'need the lanes route' }] }),
  lane('kit', 'waiting', { waitingOn: ['core'] }),
];

// Serve the demo with a laned loop added: the dashboard must show lanes whenever the API sends them.
async function withLanedLoop(page: Page) {
  await page.route('**/api/loops', async (route) => {
    const res = await route.fetch();
    const loops = (await res.json()) as Record<string, unknown>[];
    await route.fulfill({ response: res, json: [...loops, { ...loops[0], id: 'laned', name: 'laned-loop', state: 'failing', reason: 'lane web is stalled', lanes: LANES }] });
  });
  await page.route('**/api/loops/laned', async (route) => {
    const res = await route.fetch({ url: route.request().url().replace('/laned', '/proj2') });
    const loop = (await res.json()) as Record<string, unknown>;
    await route.fulfill({ response: res, json: { ...loop, id: 'laned', name: 'laned-loop', state: 'failing', lanes: LANES } });
  });
}

test('fleet card shows a lane strip and Needs you counts stalled and orphaned lanes', async ({ page }) => {
  await withLanedLoop(page);
  await page.goto('/');
  const card = page.getByTestId('loop-card').filter({ hasText: 'laned-loop' });
  await expect(card.getByTestId('lane-chip')).toHaveCount(4);
  await expect(card.getByTestId('lane-chip').nth(2)).toContainText('Stalled');
  // web is stalled, kit waits on the finished core lane: 2 things.
  await expect(page.getByRole('link', { name: /3 things need you/ })).toBeVisible();
});

test('loop detail has a Lanes tab with a row per lane, run counters, lock and unanswered messages', async ({ page }) => {
  await withLanedLoop(page);
  await page.goto('/#/loop/laned');
  await expect(page.getByRole('tab').nth(1)).toHaveText('Lanes');
  await page.getByRole('tab', { name: 'Lanes' }).click();
  const rows = page.getByTestId('lane-row');
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(1)).toContainText('Building');
  await expect(rows.nth(1)).toContainText('Run 7/30');
  await expect(rows.nth(1).getByTestId('lane-claim')).toHaveText('Unclaimed');
  await expect(rows.nth(1).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '7');
  await expect(rows.nth(1)).toContainText('Locked');
  await expect(rows.nth(2)).toContainText('Stalled');
  await expect(rows.nth(2)).toContainText('web → server: need the lanes route');
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
});

test('a loop without lanes has no Lanes tab', async ({ page }) => {
  await page.goto('/#/loop/proj2');
  await expect(page.getByRole('tab', { name: 'Timeline' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Lanes' })).toHaveCount(0);
});

test('fleet filter by status narrows the cards and can be cleared', async ({ page }) => {
  await withLanedLoop(page);
  await page.goto('/');
  const cards = page.getByTestId('loop-card');
  await expect(cards.first()).toBeVisible();
  const all = await cards.count();
  await page.getByRole('button', { name: /^Failing \(1\)/ }).click();
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('laned-loop');
  await page.getByRole('button', { name: /^All/ }).click();
  await expect(cards).toHaveCount(all);
});

test('the demo serves this repo as a laned loop with five finished lanes', async ({ page }) => {
  await page.goto('/#/loop/compounding-loop');
  await page.getByRole('tab', { name: 'Lanes' }).click();
  const rows = page.getByTestId('lane-row');
  await expect(rows).toHaveCount(5);
  for (let i = 0; i < 5; i++) await expect(rows.nth(i)).toContainText('Done');
});

const iso = (minsAgo: number) => new Date(Date.now() - minsAgo * 60_000).toISOString();
const run = (lane: string, minsAgo: number, outcome: string, extra: object = {}) => ({ lane, at: iso(minsAgo), outcome, units: [], commits: [], ...extra });

async function withRuns(page: Page, runs: object[]) {
  await page.route('**/api/loops/laned', async (route) => {
    const res = await route.fetch({ url: route.request().url().replace('/laned', '/proj2') });
    const loop = (await res.json()) as Record<string, unknown>;
    await route.fulfill({ response: res, json: { ...loop, id: 'laned', name: 'laned-loop', lanes: LANES, runs, nextRuns: [{ lane: 'web', at: iso(-30) }] } });
  });
}

test('Runs tab shows all four outcomes by word, filters by lane and warns after three missed slots', async ({ page }) => {
  await withRuns(page, [
    run('web', 10, 'pushed', { units: ['Runs tab'], tests: { passed: 40, failed: 0 }, commits: [{}] }),
    run('core', 70, 'nothing-pushed'),
    run('server', 130, 'tests-failed', { tests: { passed: 38, failed: 2 } }),
    run('kit', 190, 'no-run-recorded'), run('kit', 250, 'no-run-recorded'), run('kit', 310, 'no-run-recorded'),
  ]);
  await page.goto('/#/loop/laned');
  await page.getByRole('tab', { name: 'Runs' }).click();
  const rows = page.getByTestId('run-row');
  await expect(rows).toHaveCount(6);
  for (const word of ['Pushed', 'Ran, pushed nothing', 'Tests failed', 'No run recorded']) await expect(page.getByText(word).first()).toBeVisible();
  await expect(page.getByText('2 failed, 38 passed')).toBeVisible();
  await expect(page.getByTestId('runs-silent')).toContainText('kit');
  await page.getByRole('button', { name: 'web', exact: true }).click();
  await expect(rows).toHaveCount(1);
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
});

test('Tests tab shows the latest result, the last failure and an accessible chart', async ({ page }) => {
  await withRuns(page, [
    run('web', 10, 'pushed', { tests: { passed: 50, failed: 0 } }),
    run('server', 130, 'tests-failed', { tests: { passed: 38, failed: 2 } }),
    run('core', 250, 'pushed', { tests: { passed: 30, failed: 0 } }),
  ]);
  await page.goto('/#/loop/laned');
  await page.getByRole('tab', { name: 'Tests' }).click();
  await expect(page.getByTestId('tests-latest')).toContainText('50 tests pass');
  await expect(page.getByTestId('tests-last-failure')).toContainText('lane server');
  await expect(page.getByRole('img', { name: /Tests per recorded run, 3 runs/ })).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
});

test('Tests tab explains when no run recorded tests', async ({ page }) => {
  await withRuns(page, [run('web', 10, 'pushed')]);
  await page.goto('/#/loop/laned');
  await page.getByRole('tab', { name: 'Tests' }).click();
  await expect(page.getByText('No test results yet')).toBeVisible();
});

test('Runs tab explains an empty log and is absent for loops without runs', async ({ page }) => {
  await withRuns(page, []);
  await page.goto('/#/loop/laned');
  await page.getByRole('tab', { name: 'Runs' }).click();
  await expect(page.getByText('No runs recorded yet')).toBeVisible();
  await page.goto('/#/loop/proj2');
  await expect(page.getByRole('tab', { name: 'Runs' })).toHaveCount(0);
});

test('loop page shows the pause notice, the Ready to ship checklist and the Releases tab', async ({ page }) => {
  await page.route('**/api/loops/laned', async (route) => {
    const res = await route.fetch({ url: route.request().url().replace('/laned', '/proj2') });
    const loop = (await res.json()) as Record<string, unknown>;
    await route.fulfill({
      response: res,
      json: {
        ...loop, id: 'laned', name: 'laned-loop', lanes: LANES,
        paused: { by: 'Mina', at: '2026-10-11T14:05:00Z', reason: 'budget' },
        ship: { ready: false, openFindings: ['server: pause hangs on a prompt'], items: [{ id: 'tests', label: 'Tests pass', ok: true, detail: '176 passed' }, { id: 'tag', label: 'Tag is free', ok: false, detail: 'v0.4.0 exists' }] },
        releases: [{ version: '0.4.0', date: '2026-10-12', sections: [{ title: 'Added', items: ['Runs tab'] }], items: ['Runs tab'] }, { version: 'Unreleased', sections: [], items: [] }],
      },
    });
  });
  await page.goto('/#/loop/laned');
  await expect(page.getByTestId('paused-notice')).toContainText('Paused by Mina since 14:05 UTC · budget');
  const ship = page.getByTestId('ship-panel');
  await expect(ship.getByRole('heading', { name: 'Not ready to ship' })).toBeVisible();
  await expect(ship).toContainText('v0.4.0 exists');
  await expect(ship).toContainText('pause hangs on a prompt');
  await page.getByRole('tab', { name: 'Releases' }).click();
  await expect(page.getByTestId('release-row')).toHaveCount(2);
  await page.getByText('0.4.0', { exact: true }).click();
  await expect(page.getByTestId('release-row').first().getByRole('listitem')).toHaveText('Runs tab');
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
});

test('control buttons confirm what changes and open the exact prefilled GitHub page', async ({ page }) => {
  // No dashboard server answering means static hosting: buttons open GitHub instead of calling the API.
  await page.route('**/api/health', (route) => route.fulfill({ status: 404, body: 'no' }));
  await page.route('**/api/loops/laned*', async (route) => {
    const res = await route.fetch({ url: new URL('/api/loops/proj2', route.request().url()).href });
    const loop = (await res.json()) as Record<string, unknown>;
    await route.fulfill({ response: res, json: { ...loop, id: 'laned', name: 'laned-loop', url: 'https://github.com/o/r', lanes: LANES, ship: { ready: false, openFindings: [], items: [{ id: 'tag', label: 'Tag is free', ok: false, detail: 'v1 exists' }] } } });
  });
  await page.goto('/#/loop/laned');
  await expect(page.getByRole('button', { name: 'Release' })).toBeDisabled();
  await expect(page.getByText('Release is off: Tag is free: v1 exists')).toBeVisible();
  await page.getByRole('button', { name: 'Pause all' }).click();
  const dialog = page.getByTestId('control-dialog');
  await expect(dialog).toContainText('Adds .ai/PAUSED on main');
  await expect(dialog).toContainText('Nothing is sent from this dashboard');
  const [popup] = await Promise.all([page.waitForEvent('popup'), dialog.getByRole('button', { name: 'Pause', exact: true }).click()]);
  expect(popup.url()).toContain('https://github.com/o/r/new/main?filename=.ai%2FPAUSED');
  await popup.close();
  await page.getByRole('button', { name: 'Start next round' }).click();
  await expect(dialog.getByRole('button', { name: 'Start next round' })).toBeDisabled();
  await expect(dialog.getByTestId('brief-score')).toContainText('needs 60');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
});
