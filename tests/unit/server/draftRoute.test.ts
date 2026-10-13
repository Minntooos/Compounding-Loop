import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AbortableClaude } from '../../../src/server/claude.js';
import { gatherDraftInputs } from '../../../src/server/draftInputs.js';
import { parseDraftBody } from '../../../src/server/actionBody.js';
import { createApp } from '../../../src/server/index.js';
import { projectsSource, readLoop } from '../../../src/server/loops.js';

const BRIEF = `# Round 6

One line: a calmer cockpit.

## Who it is for
Owners who run loops while they sleep.

## Must have
- A steer button that saves in under one second
- A schedule row that shows the next run

## Done when
- \`npm test\` passes

## Out of scope
- Billing
`;
let root: string;

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), 'cl-draft-'));
  const dir = path.join(root, 'laned');
  mkdirSync(path.join(dir, '.ai'), { recursive: true });
  writeFileSync(path.join(dir, 'IDEA.md'), '# Brief\n\n## Round 5 (current)\n\nText.\n');
  writeFileSync(path.join(dir, '.ai', 'lanes.json'), JSON.stringify({ lanes: [{ name: 'core', owns: ['src/**'] }] }));
  writeFileSync(path.join(dir, '.ai', 'task.md'), '# Task\n\nRun: 1 / 5\n');
  execFileSync('git', ['init', '-q'], { cwd: dir });
});
afterAll(() => rmSync(root, { recursive: true, force: true, maxRetries: 5 }));

/** Parses the `event:`/`data:` frames of an SSE body. */
const frames = (text: string) =>
  text.split('\n\n').filter((f) => f.includes('event:')).map((f) => ({ event: /event: (.*)/.exec(f)?.[1], data: JSON.parse(/data: (.*)/.exec(f)?.[1] ?? 'null') as Record<string, unknown> }));

const post = async (claude: AbortableClaude, id = 'laned', body: unknown = {}) => {
  const app = await createApp({ demo: false, source: projectsSource(root, undefined, claude) });
  return app.request(`http://127.0.0.1:4321/api/loops/${id}/draft-brief`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
};

describe('parseDraftBody', () => {
  it('takes no body or a model id', () => {
    expect(parseDraftBody(undefined)).toEqual({ ok: true, value: {} });
    expect(parseDraftBody({ model: 'claude-opus-5-5' })).toEqual({ ok: true, value: { model: 'claude-opus-5-5' } });
  });
  it.each([{ model: '' }, { model: 'x y' }, { model: '--help' }, { model: 7 }, { model: 'a;rm' }])('rejects %j', (body) => {
    expect(parseDraftBody(body).ok).toBe(false);
  });
});

describe('POST /api/loops/:id/draft-brief', () => {
  it('streams progress, then the draft with its score, and writes nothing to the clone', async () => {
    const calls: string[][] = [];
    const res = await post(async (args) => (calls.push(args), `${BRIEF}\n`), 'laned', { model: 'claude-sonnet-5-5' });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const events = frames(await res.text());
    expect(events.map((e) => e.event)).toEqual(['progress', 'progress', 'progress', 'draft']);
    expect(events.at(-1)?.data).toMatchObject({ draft: BRIEF.trim(), score: expect.any(Number), gaps: expect.any(Array) });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(expect.arrayContaining(['claude-sonnet-5-5']));
    expect(readdirSync(path.join(root, 'laned', '.ai')).sort()).toEqual(['lanes.json', 'task.md']);
  });

  it('reports a failing claude as an error event', async () => {
    const events = frames(await (await post(async () => { throw new Error('Could not run `claude -p`'); })).text());
    expect(events.at(-1)).toMatchObject({ event: 'error', data: { error: expect.stringContaining('claude -p'), status: 422 } });
  });

  it('reports an empty draft and an unknown loop', async () => {
    expect(frames(await (await post(async () => '  \n')).text()).at(-1)).toMatchObject({ event: 'error', data: { error: expect.stringContaining('empty') } });
    expect(frames(await (await post(async () => BRIEF, 'nope')).text()).at(-1)).toMatchObject({ event: 'error', data: { status: 404 } });
  });

  it('refuses a second draft for the same loop while one runs', async () => {
    let release: (draft: string) => void = () => undefined;
    const slow: AbortableClaude = () => new Promise((resolve) => (release = resolve));
    const app = await createApp({ demo: false, source: projectsSource(root, undefined, slow) });
    const request = () => app.request('http://127.0.0.1:4321/api/loops/laned/draft-brief', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } });
    const first = Promise.resolve(request()).then((r) => r.text());
    await new Promise((r) => setTimeout(r, 300));
    const second = frames(await (await request()).text());
    expect(second.at(-1)).toMatchObject({ event: 'error', data: { error: expect.stringContaining('already being written') } });
    release(BRIEF);
    expect(frames(await first).at(-1)?.event).toBe('draft');
  });

  it('kills claude when the client stops, so the next draft is not refused', async () => {
    let signal: AbortSignal | undefined;
    let calls = 0;
    const hanging: AbortableClaude = (_args, _cwd, s) =>
      ++calls > 1 ? Promise.resolve(BRIEF) : new Promise((_, reject) => ((signal = s), s?.addEventListener('abort', () => reject(new Error('The draft was stopped.')))));
    const app = await createApp({ demo: false, source: projectsSource(root, undefined, hanging) });
    const url = 'http://127.0.0.1:4321/api/loops/laned/draft-brief';
    const first = await app.request(url, { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } });
    await new Promise((r) => setTimeout(r, 300));
    expect(signal?.aborted).toBe(false);
    await first.body?.cancel(); // what the browser does when the dialog's Stop closes the EventSource/fetch
    await new Promise((r) => setTimeout(r, 100));
    expect(signal?.aborted).toBe(true);
    const again = await app.request(url, { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } });
    expect(frames(await again.text()).at(-1)?.event).toBe('draft');
  });

  it('rejects a bad model with 400 and is read-only in the demo', async () => {
    expect((await post(async () => BRIEF, 'laned', { model: '--help' })).status).toBe(400);
    const demo = await createApp({ demo: true });
    expect((await demo.request('http://127.0.0.1:4321/api/loops/x/draft-brief', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } })).status).toBe(409);
  });
});

describe('draft inputs', () => {
  it('gathers the next-10 lists, open audit rows, unacknowledged steer and the old out-of-scope', async () => {
    const dir = path.join(root, 'ingredients');
    mkdirSync(path.join(dir, '.ai', 'audit'), { recursive: true });
    mkdirSync(path.join(dir, '.ai', 'lanes', 'core'), { recursive: true });
    writeFileSync(path.join(dir, 'IDEA.md'), '# Brief\n\n## Round 5 (current)\n\nText.\n\n## Out of scope\n- Billing\n');
    writeFileSync(path.join(dir, '.ai', 'lanes.json'), JSON.stringify({ lanes: [{ name: 'core', owns: ['src/**'] }] }));
    writeFileSync(path.join(dir, '.ai', 'audit', 'core.md'), '| id | finding | status |\n|---|---|---|\n| A1 | Slow parse | open |\n| A2 | Typo | fixed |\n');
    writeFileSync(path.join(dir, '.ai', 'lanes', 'core', 'steer.md'), '# Steering\n\n## 2026-10-13 10:00 UTC · owner · next-run\nMake it faster.\n');
    const inputs = await gatherDraftInputs(dir);
    expect(inputs).toMatchObject({ name: 'ingredients', round: 6, outOfScope: ['Billing'] });
    expect(inputs.findings.map((f) => f.text)).toEqual([expect.stringContaining('Slow parse')]);
    expect(inputs.steer).toEqual([{ lane: 'core', entries: [expect.objectContaining({ text: expect.stringContaining('faster') })] }]);
  });

  it('rides on the local loop detail for the next-round dialog', async () => {
    expect((await readLoop(path.join(root, 'ingredients'))).draftInputs).toMatchObject({ round: 6, outOfScope: ['Billing'] });
  });

  it('is empty, not an error, for a repo with none of those files', async () => {
    expect(await gatherDraftInputs(path.join(root, 'laned'))).toMatchObject({ next: [], findings: [], steer: [], outOfScope: [] });
  });
});
