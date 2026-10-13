import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { writableServer } from './writable';

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
  // The badge never contradicts the sentence: a held-back lane is not "Building" (design review, run 5).
  await expect(row(page, 'core').getByTestId('lane-badge')).toHaveText('Building');
  await expect(row(page, 'kit').getByTestId('lane-badge')).toHaveText('Snoozed');
  await expect(row(page, 'server').getByTestId('lane-badge')).toHaveText('Paused');
  await expect(row(page, 'docs').getByTestId('lane-badge')).toHaveText('Sleeping');
  expect(errors).toEqual([]);
});

test('a fleet card whose routines look off says Stalled, like the strip', async ({ page }) => {
  await serve(page, { ...LOOP, runOutcomes: { limitStops5h: 4, running: [], sleeping: [], routinesLookOff: true } });
  await page.goto('/#/');
  await expect(page.getByTestId('loop-card').getByTestId('status-badge')).toHaveText('Stalled');
  await expect(page.getByTestId('loop-card')).toContainText('Routines look off');
  await page.goto('/#/loop/self');
  await expect(page.getByTestId('status-badge')).toHaveText('Stalled');
});

test('fleet card lane chips show sleeping lanes', async ({ page }) => {
  await serve(page, { ...LOOP, runOutcomes: { limitStops5h: 0, running: [], sleeping: ['kit', 'docs'], routinesLookOff: false } });
  await page.goto('/#/');
  await expect(page.getByTestId('lane-chip')).toHaveText(['Buildingcore', 'Sleepingkit', 'Buildingserver', 'Sleepingdocs']);
});

test('fleet card lane chips show the whole loop paused', async ({ page }) => {
  await serve(page, { ...LOOP, paused: { by: 'sam', at: '2026-10-13T12:00:00Z' } });
  await page.goto('/#/');
  await expect(page.getByTestId('lane-chip')).toHaveText(['Pausedcore', 'Pausedkit', 'Pausedserver', 'Pauseddocs']);
  // A paused loop runs nothing: its card and header say Paused, like the strip, not Building.
  await expect(page.getByTestId('loop-card').getByTestId('status-badge')).toHaveText('Paused');
  await page.goto('/#/loop/self');
  await expect(page.getByTestId('status-badge')).toHaveText('Paused');
  // No build reason beside the Paused badge; the notice under the header says who paused it.
  await expect(page.getByTestId('header-reason')).toHaveCount(0);
  await expect(page.getByTestId('paused-notice')).toContainText('Paused by sam since 12:00 UTC');
});

test('the whole loop paused holds every lane', async ({ page }) => {
  await serve(page, { ...LOOP, paused: { by: 'sam', at: '2026-10-13T12:00:00Z' } });
  await expect(page.getByTestId('lane-schedule')).toHaveText(Array(4).fill('Paused with the whole loop'));
  await expect(page.getByTestId('lane-row').getByTestId('lane-badge')).toHaveText(Array(4).fill('Paused'));
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

test('demo: a lane the schedule can change links to schedule.json on GitHub; a finished one has no button', async ({ page }) => {
  await serve(page, { ...LOOP, lanes: [lane('core'), { ...lane('kit'), state: 'done' }] });
  await expect(row(page, 'core').getByTestId('schedule-edit')).toHaveAttribute('href', 'https://github.com/o/r/edit/main/.ai/schedule.json');
  await expect(row(page, 'kit').getByTestId('schedule-edit')).toHaveCount(0);
});

test('local: Wake posts at once, Pause asks first, Snooze offers presets; errors stay on the row', async ({ page }) => {
  await writableServer(page);
  await page.clock.install({ time: new Date('2026-10-13T12:40:00Z') });
  await page.route('**/api/loops', (r) => r.fulfill({ json: [LOOP] }));
  await page.route('**/api/loops/self', (r) => r.fulfill({ json: LOOP }));
  await page.route('**/api/inbox', (r) => r.fulfill({ json: [] }));
  const posted: unknown[] = [];
  await page.route('**/api/loops/self/schedule', (r) => {
    const body = r.request().postDataJSON() as { action: string };
    posted.push(body);
    return body.action === 'resume' ? r.fulfill({ status: 422, json: { error: 'git commit failed' } }) : r.fulfill({ json: { ok: true, changed: true, lanes: ['x'], pushed: true } });
  });
  await page.goto('/#/loop/self');
  await page.getByRole('tab', { name: 'Lanes' }).click();
  await row(page, 'docs').getByRole('button', { name: 'Wake now docs' }).click();
  await expect(page.getByText('Woke docs: it runs at its next slot')).toBeVisible();
  await row(page, 'core').getByRole('button', { name: 'Pause lane core' }).click();
  expect(posted).toHaveLength(1);
  // The clicked button is gone: focus moves into the inline step, and back out on Cancel.
  await expect(row(page, 'core').getByRole('button', { name: 'Confirm pause' })).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(row(page, 'core').getByRole('button', { name: 'Pause lane core' })).toBeFocused();
  await row(page, 'core').getByRole('button', { name: 'Pause lane core' }).click();
  await row(page, 'core').getByRole('button', { name: 'Confirm pause' }).click();
  await row(page, 'core').getByRole('button', { name: 'Snooze until… core' }).click();
  await row(page, 'core').getByRole('button', { name: '3 h' }).click();
  await row(page, 'server').getByRole('button', { name: 'Resume server' }).click();
  await expect(row(page, 'server').getByTestId('schedule-error')).toHaveText('git commit failed');
  expect(posted).toEqual([{ action: 'wake', lane: 'docs' }, { action: 'pause', lane: 'core' }, { action: 'snooze', lane: 'core', until: '3h' }, { action: 'resume', lane: 'server' }]);
});
