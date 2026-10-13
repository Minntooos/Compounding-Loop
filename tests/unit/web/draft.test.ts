import { describe, expect, it } from 'vitest';
import { buildDraftPrompt, type DraftInputs } from '../../../src/core/draftBrief.js';
import type { LoopDetail } from '../../../src/core/types.js';
import { briefVerdict, draftInputsFor, draftPrompt, ingredientGroups, takeSseEvents } from '../../../web/src/lib/draft.js';

const LOOP = { id: 'self', name: 'self', state: 'done', reason: '', round: 5, roundsTotal: 5, run: 0, runLimit: 0, timeline: [], contract: [], knowledge: [], decisions: [] } as unknown as LoopDetail;
const INPUTS: DraftInputs = {
  name: 'self', round: 6,
  next: [{ source: 'DONE.md', items: ['Heat map legend', 'Pace control'] }],
  findings: [{ source: '.ai/audit/web.md', text: 'A6 · tab fade' }],
  steer: [{ lane: 'web', entries: [{ at: '2026-10-13T14:05:00Z', author: 'owner', scope: 'next-run', text: 'Ship the\nlegend first.' }] }],
  outOfScope: ['Accounts'],
};

describe('next-round draft (C6)', () => {
  it('uses the server inputs when the loop carries them', () => {
    expect(draftInputsFor({ ...LOOP, draftInputs: INPUTS })).toEqual({ inputs: INPUTS, complete: true });
  });

  it('falls back to open findings and unread steer entries, and says the DONE lists are missing', () => {
    const loop = {
      ...LOOP,
      ship: { ready: false, items: [], openFindings: ['A3 health'] },
      steer: [
        { lane: 'web', entries: [{ at: 'x', author: 'o', scope: 'next-run', text: 'read', ack: { state: 'done', run: 3 } }, { at: 'y', author: 'o', scope: 'standing', text: 'unread' }] },
        { lane: 'core', entries: [{ at: 'z', author: 'o', scope: 'next-run', text: 'old', ack: { state: 'not-done', why: 'later' } }] },
      ],
    } as unknown as LoopDetail;
    const { inputs, complete } = draftInputsFor(loop);
    expect(complete).toBe(false);
    expect(inputs.round).toBe(6);
    expect(inputs.findings).toEqual([{ source: 'audit', text: 'A3 health' }]);
    expect(inputs.steer.map((s) => [s.lane, s.entries.map((e) => e.text)])).toEqual([['web', ['unread']]]);
    expect(inputs.next).toEqual([]);
  });

  it('groups the ingredients in prompt order with counts and one line per item', () => {
    expect(ingredientGroups(INPUTS)).toEqual([
      { id: 'next', title: 'Next-10 items', items: ['DONE.md: Heat map legend', 'DONE.md: Pace control'] },
      { id: 'findings', title: 'Open audit findings', items: ['.ai/audit/web.md: A6 · tab fade'] },
      { id: 'steer', title: 'Unread steering', items: ['web: Ship the legend first.'] },
      { id: 'out-of-scope', title: 'Out of scope last round', items: ['Accounts'] },
    ]);
  });

  it('copies core’s own prompt', () => {
    expect(draftPrompt(INPUTS)).toBe(buildDraftPrompt(INPUTS));
  });

  it('scores the brief and names the costliest missing part', () => {
    const empty = briefVerdict('');
    expect(empty.ok).toBe(false);
    expect(empty.score).toBe(0);
    expect(empty.missing).toBeTruthy();
    const good = briefVerdict([
      '# Quilt calculators', '**What we are building:** calculators for quilters who plan fabric.', '## Audience', 'Hobby quilters who plan fabric purchases.',
      '## Must have', '1. Backing calculator in `src/backing.ts`', '2. Binding length in `src/binding.ts`', '3. Batting chooser with 3 sizes',
      '## Done when', '- `npm test` passes', '## Out of scope', '- Accounts, payments, analytics',
    ].join('\n'));
    expect(good.score).toBeGreaterThanOrEqual(60);
    expect(good.ok).toBe(true);
  });

  it('splits an event stream into whole events and keeps the unfinished tail', () => {
    const first = takeSseEvents('event: progress\ndata: {"step":"Reading"}\n\n: keep-alive\n\nevent: draft\r\ndata: {"dra');
    expect(first.events).toEqual([{ event: 'progress', data: '{"step":"Reading"}' }]);
    const second = takeSseEvents(`${first.rest}ft":"x"}\r\n\r\n`);
    expect(second).toEqual({ events: [{ event: 'draft', data: '{"draft":"x"}' }], rest: '' });
    expect(takeSseEvents('data: a\ndata: b\n\n').events).toEqual([{ event: 'message', data: 'a\nb' }]);
  });
});
