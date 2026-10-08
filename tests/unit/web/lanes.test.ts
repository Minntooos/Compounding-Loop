import { describe, expect, it } from 'vitest';
import type { LaneStatus, LoopSummary } from '../../../src/core/types.js';
import { describeUnanswered, lanesNeedingYou, needsYouCount, waitingOnFinished } from '../../../web/src/lib/lanes.js';

const lane = (name: string, state: LaneStatus['state'], waitingOn?: string[]): LaneStatus => ({ name, state, run: 1, limit: 30, locked: false, unanswered: [], ...(waitingOn ? { waitingOn } : {}) });
const loop = (state: LoopSummary['state'], lanes?: LaneStatus[]): LoopSummary => ({ id: 'x', name: 'x', state, ...(lanes ? { lanes } : {}) }) as LoopSummary;

describe('lane attention', () => {
  it('waitingOnFinished finds unfinished lanes waiting on a done lane', () => {
    const lanes = [lane('core', 'done'), lane('web', 'waiting', ['core']), lane('docs', 'done', ['core'])];
    expect(waitingOnFinished(lanes).map((l) => l.name)).toEqual(['web']);
  });

  it('lanesNeedingYou counts stalled once and orphaned lanes, not blocked ones (the inbox has those)', () => {
    const lanes = [lane('core', 'done'), lane('web', 'stalled', ['core']), lane('kit', 'waiting', ['core']), lane('server', 'blocked')];
    expect(lanesNeedingYou(lanes).map((l) => l.name)).toEqual(['web', 'kit']);
    expect(lanesNeedingYou(undefined)).toEqual([]);
  });

  it('needsYouCount adds inbox, lane problems, and failing loops without lane problems', () => {
    const loops = [loop('done'), loop('failing'), loop('failing', [lane('a', 'stalled'), lane('b', 'stalled')]), loop('building', [lane('c', 'building')])];
    expect(needsYouCount(loops, 1)).toBe(1 + 1 + 2);
    expect(needsYouCount([], 0)).toBe(0);
  });

  it('describeUnanswered reads "web → server: text"', () => {
    expect(describeUnanswered({ from: 'web', to: 'server', text: 'need X' })).toBe('web → server: need X');
  });
});
