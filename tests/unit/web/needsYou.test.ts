import { describe, expect, it } from 'vitest';
import type { InboxItem, LaneStatus, LoopSummary } from '../../../src/core/types.js';
import { attentionItems } from '../../../web/src/lib/lanes.js';
import { needsYouRows } from '../../../web/src/lib/needsYou.js';

const lane = (name: string, state: LaneStatus['state']): LaneStatus => ({ name, state, run: 1, limit: 20, locked: false, unanswered: [] });
const loop = (id: string, over: Partial<LoopSummary> = {}): LoopSummary =>
  ({ id, name: `${id} name`, state: 'building', reason: 'r', round: 1, roundsTotal: 1, run: 1, runLimit: 1, repoUrl: 'https://github.com/o/r', ...over }) as LoopSummary;
const question: InboxItem = { loopId: 'q', file: 'BLOCKED.md', question: 'Which port?\nmore', bestGuess: '80', since: '2026-10-13T00:00:00Z' };

describe('needsYouRows', () => {
  const loops = [
    loop('rel', { state: 'done', lanes: [lane('core', 'done')] }),
    loop('st', { lanes: [lane('web', 'stalled')] }),
    loop('f', { state: 'failing', reason: 'tests fail' }),
    loop('q', { state: 'blocked' }),
  ];
  const rows = (demo: boolean) => needsYouRows(attentionItems(loops, [question]), loops, demo);

  it('orders questions, failing, stalled, then release, one row per attention item', () => {
    expect(rows(false).map((r) => r.group)).toEqual(['question', 'failing', 'stalled', 'release']);
    expect(rows(false)).toHaveLength(attentionItems(loops, [question]).length);
  });
  it('local actions: Answer, Open checks, Review & release; a stalled lane explains itself', () => {
    const [q, f, s, r] = rows(false);
    expect(q?.text).toBe('Which port?');
    expect(q?.action).toEqual({ label: 'Answer', href: '#/inbox' });
    expect(f?.action.label).toBe('Open checks');
    expect(s?.text).toBe('Lane web is stalled');
    expect(s?.explain).toMatch(/usage limit/);
    expect(r?.action).toEqual({ label: 'Review & release', href: '#/loop/rel' });
    expect(r?.loopName).toBe('rel name');
  });
  it('demo actions open the exact GitHub editor page', () => {
    const [q, , s] = rows(true);
    expect(q?.action).toEqual({ label: 'Edit on GitHub', href: 'https://github.com/o/r/edit/main/BLOCKED.md', external: true });
    expect(s?.action).toEqual({ label: 'Edit on GitHub', href: 'https://github.com/o/r/edit/main/.ai/schedule.json', external: true });
  });
  it('a demo loop without a GitHub repo falls back to opening the loop', () => {
    const l = [loop('st', { lanes: [lane('web', 'stalled')], repoUrl: undefined, url: 'https://example.com' })];
    expect(needsYouRows(attentionItems(l, []), l, true)[0]?.action).toEqual({ label: 'Open loop', href: '#/loop/st' });
  });
});
