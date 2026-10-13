import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { writableServer } from './writable';

// Round 5 C6: the next-round dialog shows its ingredients, drafts with Claude (local SSE) or copies the prompt (demo),
// scores the brief live, and only a separate Start click starts the round.
const lane = (name: string) => ({ name, state: 'done', run: 9, limit: 20, locked: false, unanswered: [] });
const DRAFT_INPUTS = {
  name: 'self', round: 6,
  next: [{ source: 'DONE.md', items: ['Heat map legend', 'Pace control'] }, { source: '.ai/lanes/web/DONE.md', items: ['Compress phone shots'] }],
  findings: [{ source: '.ai/audit/web.md', text: 'A6 · tab fade on Firefox' }],
  steer: [{ lane: 'web', entries: [{ at: '2026-10-13T14:00:00Z', author: 'owner', scope: 'next-run', text: 'Legend first.' }] }],
  outOfScope: ['Accounts'],
};
const LOOP = { id: 'self', name: 'self', state: 'done', reason: 'Done', repoUrl: 'https://github.com/o/r', round: 5, roundsTotal: 5, run: 0, runLimit: 0, lanes: [lane('core'), lane('web')], timeline: [], contract: [], knowledge: [], decisions: [], draftInputs: DRAFT_INPUTS };
const GOOD_BRIEF = [
  '## Round 6: 0.6.0 Polish', '**What we are building:** a calmer cockpit for quilters of code loops.', '**Audience:** owners of laned loops.',
  '### A. Fixes', '1. Heat-map legend in `web/src/components/HeatMap.tsx`', '2. Pace control posts to `/api/loops/:id/pace`', '3. Phone shots under 400 kB',
  '### Round 6 done when', '- `npm test` passes', '**Out of scope:**', '- Accounts',
].join('\n');

async function serve(page: Page, opts: { demo: boolean }) {
  if (opts.demo) await page.route('**/api/health', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  if (opts.demo) await page.route('**/live.json', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await page.route(opts.demo ? '**/api/loops.json' : '**/api/loops', (r) => r.fulfill({ json: [LOOP] }));
  await page.route(opts.demo ? '**/api/loops/self.json' : '**/api/loops/self', (r) => r.fulfill({ json: LOOP }));
  await page.route(opts.demo ? '**/api/inbox.json' : '**/api/inbox', (r) => r.fulfill({ json: [] }));
  await page.addInitScript(() => { (window as unknown as { opened: string[] }).opened = []; window.open = (url?: string | URL) => { (window as unknown as { opened: string[] }).opened.push(String(url)); return null; }; });
}

const sse = (events: [string, unknown][]) => events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('');

test('demo: ingredients are listed, Copy prompt copies core’s prompt, and Start opens GitHub only when the brief scores', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/\/api\/health|\/live\.json/.test(m.location().url)) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await serve(page, { demo: true });
  await page.goto('/#/loop/self');
  await page.getByRole('button', { name: 'Start next round' }).click();
  const dialog = page.getByTestId('control-dialog');
  const ingredients = dialog.getByTestId('draft-ingredients');
  await expect(ingredients.getByRole('region', { name: 'Next-10 items, 3' })).toContainText('.ai/lanes/web/DONE.md: Compress phone shots');
  await expect(ingredients.getByRole('region', { name: 'Unread steering, 1' })).toContainText('web: Legend first.');
  await expect(dialog.getByRole('button', { name: 'Draft with Claude' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Copy prompt for Claude Code' }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('You are drafting the brief for round 6 of self');
  expect(copied).toContain('- Heat map legend');
  const start = dialog.getByRole('button', { name: 'Start round 6' });
  await expect(start).toBeDisabled();
  await expect(dialog.getByTestId('brief-score')).toContainText('Brief score 0/100 (needs 60)');
  await dialog.getByLabel('Brief for round 6').fill(GOOD_BRIEF);
  await expect(start).toBeEnabled();
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
  await start.click();
  const opened = await page.evaluate(() => (window as unknown as { opened: string[] }).opened);
  expect(opened).toHaveLength(1);
  expect(opened[0]).toMatch(/^https:\/\/github\.com\/o\/r\/new\/main\?filename=\.ai%2Fnext-round\.md&value=%23%23%20Round%206/);
  expect(errors).toEqual([]);
});

test('local: Draft with Claude streams progress, fills the box, and only Start posts the round', async ({ page }) => {
  await writableServer(page);
  await serve(page, { demo: false });
  const posted: string[] = [];
  await page.route('**/api/loops/self/draft-brief', (r) => r.fulfill({ contentType: 'text/event-stream', body: sse([['progress', { step: 'Reading DONE files, audit findings and steering' }], ['progress', { step: 'Scoring the draft' }], ['draft', { draft: GOOD_BRIEF, score: 90, gaps: [] }]]) }));
  await page.route('**/api/loops/self/next-round', (r) => { posted.push(r.request().postDataJSON().brief as string); return r.fulfill({ json: { ok: true, changed: true, committed: true, pushed: true } }); });
  await page.goto('/#/loop/self');
  await page.getByRole('button', { name: 'Start next round' }).click();
  const dialog = page.getByTestId('control-dialog');
  await dialog.getByLabel('Brief for round 6').fill('my own notes');
  await dialog.getByRole('button', { name: 'Draft with Claude' }).click();
  await expect(dialog.getByTestId('draft-status')).toHaveText('Draft ready · score 90/100. Edit it, then start the round.');
  await expect(dialog.getByLabel('Brief for round 6')).toHaveValue(GOOD_BRIEF);
  expect(posted).toEqual([]);
  await dialog.getByRole('button', { name: 'Put back my text' }).click();
  await expect(dialog.getByLabel('Brief for round 6')).toHaveValue('my own notes');
  await dialog.getByLabel('Brief for round 6').fill(GOOD_BRIEF);
  await dialog.getByRole('button', { name: 'Start round 6' }).click();
  await expect(page.getByTestId('toast')).toContainText('Round 6 started');
  expect(posted).toEqual([GOOD_BRIEF]);
});

test('local: a failed draft says why and offers Retry draft; the brief stays editable', async ({ page }) => {
  await writableServer(page);
  await serve(page, { demo: false });
  await page.route('**/api/loops/self/draft-brief', (r) => r.fulfill({ contentType: 'text/event-stream', body: sse([['progress', { step: 'Asking Claude Code' }], ['error', { error: 'claude exited with code 1', status: 422 }]]) }));
  await page.goto('/#/loop/self');
  await page.getByRole('button', { name: 'Start next round' }).click();
  const dialog = page.getByTestId('control-dialog');
  await dialog.getByRole('button', { name: 'Draft with Claude' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Draft failed: claude exited with code 1');
  await expect(dialog.getByRole('button', { name: 'Retry draft' })).toBeVisible();
  await expect(dialog.getByLabel('Brief for round 6')).toBeEditable();
});

test('demo without the DONE lists copies the command that prints the full prompt, not a partial prompt', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await serve(page, { demo: true });
  const { draftInputs: _omit, ...partial } = LOOP;
  await page.route('**/api/loops/self.json', (r) => r.fulfill({ json: partial }));
  await page.goto('/#/loop/self');
  await page.getByRole('button', { name: 'Start next round' }).click();
  const dialog = page.getByTestId('control-dialog');
  await expect(dialog.getByTestId('draft-ingredients')).toContainText('This view has no DONE next-10 lists');
  await dialog.getByRole('button', { name: 'Copy the prompt command' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('npx compounding-loop next-round --draft --print-prompt');
});

test('local: committed but not pushed offers Close, not a Retry that would start the round or pause again', async ({ page }) => {
  await writableServer(page);
  await serve(page, { demo: false });
  const posted: string[] = [];
  const notPushed = { ok: true, changed: true, committed: true, pushed: false, pushError: 'no upstream' };
  await page.route('**/api/loops/self/next-round', (r) => { posted.push('next-round'); return r.fulfill({ json: notPushed }); });
  await page.route('**/api/loops/self/pause', (r) => { posted.push('pause'); return r.fulfill({ json: notPushed }); });
  await page.goto('/#/loop/self');
  await page.getByRole('button', { name: 'Start next round' }).click();
  const dialog = page.getByTestId('control-dialog');
  await dialog.getByLabel('Brief for round 6').fill(GOOD_BRIEF);
  await dialog.getByRole('button', { name: 'Start round 6' }).click();
  await expect(dialog.getByRole('alert')).toHaveText(/^Committed in the \S+ folder but not pushed: no upstream\. Run git push there so the lanes see it\.$/);
  await expect(dialog.getByRole('button', { name: /Retry|Start round/ })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Pause all' }).click();
  await dialog.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('not pushed');
  await expect(dialog.getByRole('button', { name: /Retry|Pause/ })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
  expect(posted).toEqual(['next-round', 'pause']);
});
