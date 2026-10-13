// C6: the next-round dialog's pure parts. The ingredients and the prompt come from core's DraftInputs and
// buildDraftPrompt, so the dialog shows exactly what `loop next-round --draft` puts in its prompt.
import { lintBrief, MIN_BRIEF_SCORE } from '../../../src/core/brief.js';
import { buildDraftPrompt, type DraftInputs } from '../../../src/core/draftBrief.js';
import { unacknowledged } from '../../../src/core/parse/steer.js';
import type { LoopDetail } from '../../../src/core/types.js';

export interface IngredientGroup {
  id: 'next' | 'findings' | 'steer' | 'out-of-scope';
  title: string;
  items: string[];
}

/**
 * What a draft is made from. Prefers the server's `draftInputs`; without it, the open findings and unread steer
 * entries the loop already carries, and `complete: false` so the dialog can say the DONE lists are not in this view.
 */
export function draftInputsFor(loop: LoopDetail): { inputs: DraftInputs; complete: boolean } {
  if (loop.draftInputs) return { inputs: loop.draftInputs, complete: true };
  const steer = (loop.steer ?? []).map((s) => ({ lane: s.lane, entries: unacknowledged(s.entries) })).filter((s) => s.entries.length > 0);
  const findings = (loop.ship?.openFindings ?? []).map((text) => ({ source: 'audit', text }));
  return { inputs: { name: loop.name, round: loop.round + 1, next: [], findings, steer, outOfScope: [] }, complete: false };
}

/** The four counted groups of the Ingredients section, in prompt order. */
export function ingredientGroups(inputs: DraftInputs): IngredientGroup[] {
  return [
    { id: 'next', title: 'Next-10 items', items: inputs.next.flatMap((n) => n.items.map((item) => `${n.source}: ${item}`)) },
    { id: 'findings', title: 'Open audit findings', items: inputs.findings.map((f) => `${f.source}: ${f.text}`) },
    { id: 'steer', title: 'Unread steering', items: inputs.steer.flatMap((s) => s.entries.map((e) => `${s.lane}: ${e.text.replace(/\s+/g, ' ')}`)) },
    { id: 'out-of-scope', title: 'Out of scope last round', items: inputs.outOfScope },
  ];
}

/** The prompt the demo copies for Claude Code: core's own builder, never a web copy of it. */
export const draftPrompt = (inputs: DraftInputs): string => buildDraftPrompt(inputs);

/** The live score line under the brief box: the score, whether it clears the bar, and the costliest missing part. */
export function briefVerdict(text: string): { score: number; ok: boolean; missing?: string } {
  const { score, gaps } = lintBrief(text);
  const worst = [...gaps].sort((a, b) => b.cost - a.cost)[0];
  return { score, ok: score >= MIN_BRIEF_SCORE, ...(worst && { missing: worst.message }) };
}

export interface SseEvent {
  event: string;
  data: string;
}

/** Splits a text/event-stream buffer into whole events and the unfinished tail (kept for the next chunk). */
export function takeSseEvents(buffer: string): { events: SseEvent[]; rest: string } {
  const blocks = buffer.replace(/\r\n?/g, '\n').split('\n\n');
  const rest = blocks.pop() ?? '';
  const events: SseEvent[] = [];
  for (const block of blocks) {
    let event = 'message';
    const data: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const field = colon < 0 ? line : line.slice(0, colon);
      const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '');
      if (field === 'event') event = value;
      else if (field === 'data') data.push(value);
    }
    if (data.length > 0) events.push({ event, data: data.join('\n') });
  }
  return { events, rest };
}
