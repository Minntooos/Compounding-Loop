import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Round 5 C4 history and C5 state: each lane on the Lanes tab says its schedule in words and lists its steer entries with their acknowledgements.
const lane = (name: string) => ({ name, state: 'building', run: 3, limit: 20, locked: false, unanswered: [] });
const LOOP = {
  id: 'self', name: 'self', state: 'building', reason: 'Building', repoUrl: 'https://github.com/o/r', round: 5, roundsTotal: 5, run: 0, runLimit: 0,
  lanes: ['core', 'kit', 'server', 'docs'].map(lane), timeline: [], contract: [], knowledge: [], decisions: [],
  schedule: { version: 1, lanes: {
    kit: { notBefore: '2026-10-13T15:15:00Z', sleeping: false, paused: false, reason: 'idle twice in a row' },
    server: { notBefore: null, sleeping: false, paused: true, reason: 'release week' },
    docs: { notBefore: null, sleeping: true, paused: false, reason: 'docs waits for the first features' },
  } },
  idleRuns: { core: 0, kit: 2, server: 0, docs: 3 },
  steer: [{ lane: 'core', entries: [
    { at: '2026-10-13T11:30:00Z', author: 'owner', scope: 'next-run', text: 'Ship the pace parser first.' },
    { at: '2026-10-13T09:10:00Z', author: 'owner', scope: 'next-run', text: 'Add npm state.', ack: { state: 'not-done', why: 'npm is live mode only' } },
    { at: '2026-10-12T21:00:00Z', author: 'sam', scope: 'standing', text: 'Keep --json on every command.', ack: { state: 'done', run: 1 } },
  ] }],
};

async function serve(page: Page, loop: object = LOOP, clock = true) {
  if (clock) await page.clock.install({ time: new Date('2026-10-13T12:40:00Z') });
  await page.route('**/api/health', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await page.route('**/live.json', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/loops.json', (r) => r.fulfill({ json: [loop] }));
  await page.route('**/api/loops/self.json', (r) => r.fulfill({ json: loop }));
  await page.route('**/api/inbox.json', (r) => r.fulfill({ json: [] }));
  await page.goto('/#/loop/self');
  await page.getByRole('tab', { name: 'Lanes' }).click();
}

const row = (page: Page, name: string) => page.getByTestId('lane-row').filter({ has: page.getByRole('heading', { name, exact: true }) });

test('each lane states its schedule as a sentence', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/\/api\/health|\/live\.json/.test(m.location().url)) errors.push(m.text()); });
  await serve(page);
  await expect(row(page, 'core').getByTestId('lane-schedule')).toHaveText('Due');
  await expect(row(page, 'kit').getByTestId('lane-schedule')).toHaveText('Snoozed until 15:15 UTC · idle twice in a row');
  await expect(row(page, 'server').getByTestId('lane-schedule')).toHaveText('Paused · release week');
  await expect(row(page, 'docs').getByTestId('lane-schedule')).toHaveText('Sleeping · 3 idle runs · docs waits for the first features');
  expect(errors).toEqual([]);
});

test('the whole loop paused holds every lane', async ({ page }) => {
  await serve(page, { ...LOOP, paused: { by: 'sam', at: '2026-10-13T12:00:00Z' } });
  await expect(page.getByTestId('lane-schedule')).toHaveText(Array(4).fill('Paused with the whole loop'));
});

test('steer history lists each entry with its acknowledgement, newest first', async ({ page }) => {
  await serve(page);
  const history = row(page, 'core').getByTestId('steer-history');
  await expect(history.locator('summary')).toHaveText('Steer history · 3 · 1 waiting');
  await history.locator('summary').click();
  await expect(history.getByTestId('steer-ack')).toHaveText(['waiting for the next run', 'not done: npm is live mode only', 'done in run 1']);
  await expect(history.getByTestId('steer-entry').first()).toContainText('Tue 13 Oct 11:30 UTC · owner · next run');
  await expect(history.getByTestId('steer-entry').last()).toContainText('sam · standing');
  // Lanes with no steer.md show no history.
  await expect(row(page, 'kit').getByTestId('steer-history')).toHaveCount(0);
});

test('a finished lane says so, and a snapshot reads its schedule at its own time', async ({ page }) => {
  // The frozen demo is read at its newest moment (the last run), so its snooze never expires on a later day.
  const frozen = { ...LOOP, snapshotAt: '2026-10-11T14:51:27Z', lastRun: { lane: 'web', at: '2026-10-13T12:35:00Z', outcome: 'pushed' }, lanes: [{ ...lane('core'), state: 'done' }, lane('kit'), lane('server'), lane('docs')] };
  await page.clock.install({ time: new Date('2026-10-20T09:00:00Z') });
  await serve(page, frozen, false);
  await expect(row(page, 'core').getByTestId('lane-schedule')).toHaveText('Finished · no more runs');
  // An unread entry on a finished lane will never be picked up, so it does not say "waiting".
  const history = row(page, 'core').getByTestId('steer-history');
  await expect(history.locator('summary')).toHaveText('Steer history · 3');
  await history.locator('summary').click();
  await expect(history.getByTestId('steer-ack').first()).toHaveText('not picked up: the lane is finished');
  await expect(row(page, 'kit').getByTestId('lane-schedule')).toHaveText('Snoozed until 15:15 UTC · idle twice in a row');
});

test('a loop without schedule data shows no schedule line', async ({ page }) => {
  const { schedule: _s, idleRuns: _i, steer: _t, ...bare } = LOOP;
  await serve(page, bare);
  await expect(page.getByTestId('lane-row')).toHaveCount(4);
  await expect(page.getByTestId('lane-schedule')).toHaveCount(0);
});

for (const theme of ['light', 'dark'] as const) {
  test(`axe: lanes with schedule and steer history in the ${theme} theme`, async ({ page }) => {
    await page.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch { /* blocked */ } }, theme);
    await serve(page);
    await row(page, 'core').getByTestId('steer-history').locator('summary').click();
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
