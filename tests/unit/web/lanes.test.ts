import { describe, expect, it } from 'vitest';
import type { LaneStatus, LoopSummary } from '../../../src/core/types.js';
import { attentionItems, releaseWaiting, claimText, describeUnanswered, lanesNeedingYou, needsYouCount, waitingOnFinished } from '../../../web/src/lib/lanes.js';

const lane = (name: string, state: LaneStatus['state'], waitingOn?: string[]): LaneStatus => ({ name, state, run: 1, limit: 30, locked: false, unanswered: [], ...(waitingOn ? { waitingOn } : {}) });
const loop = (state: LoopSummary['state'], lanes?: LaneStatus[]): LoopSummary => ({ id: 'x', name: 'x', state, ...(lanes ? { lanes } : {}) }) as LoopSummary;

describe('lane attention', () => {
  it('waitingOnFinished finds unfinished lanes waiting on a done lane', () => {
    const lanes = [lane('core', 'done'), lane('web', 'waiting', ['core']), lane('docs', 'done', ['core'])];
    expect(waitingOnFinished(lanes).map((l) => l.name)).toEqual(['web']);
  });

  it('lanesNeedingYou counts stalled, blocked and orphaned lanes', () => {
    const lanes = [lane('core', 'done'), lane('web', 'stalled', ['core']), lane('kit', 'waiting', ['core']), lane('server', 'blocked')];
    expect(lanesNeedingYou(lanes).map((l) => l.name)).toEqual(['web', 'server', 'kit']);
    expect(lanesNeedingYou(undefined)).toEqual([]);
  });

  it('needsYouCount adds inbox, lane problems, and failing loops without lane problems', () => {
    const loops = [loop('done'), loop('failing'), loop('failing', [lane('a', 'stalled'), lane('b', 'stalled')]), loop('building', [lane('c', 'building')])];
    const inbox = [{ loopId: 'other' }];
    expect(needsYouCount(loops, inbox)).toBe(1 + 1 + 2);
    expect(needsYouCount([], [])).toBe(0);
  });

  it('a blocked lane is not counted twice when its loop already has an inbox item', () => {
    const blocked = { ...loop('blocked', [lane('a', 'blocked')]), id: 'L' };
    expect(needsYouCount([blocked], [])).toBe(1);
    expect(needsYouCount([blocked], [{ loopId: 'L' }])).toBe(1);
  });

  it('describeUnanswered reads "web → server: text"', () => {
    expect(describeUnanswered({ from: 'web', to: 'server', text: 'need X' })).toBe('web → server: need X');
  });
  it('claimText names the claimant and expiry in UTC, or says unclaimed', () => {
    expect(claimText({ name: 'sam', expiresAt: '2026-10-11T16:30:00Z' })).toBe('sam · expires 16:30 UTC');
    expect(claimText(undefined)).toBe('Unclaimed');
  });
});

describe('releaseWaiting (round 4 A2)', () => {
  it('is true only for a done loop with lanes, and counts in needsYouCount', () => {
    const lanes = [{ name: 'web', state: 'done' }] as never;
    expect(releaseWaiting({ state: 'done', lanes })).toBe(true);
    expect(releaseWaiting({ state: 'done' })).toBe(false);
    expect(releaseWaiting({ state: 'building', lanes })).toBe(false);
    expect(needsYouCount([{ id: 'a', state: 'done', lanes } as never], [])).toBe(1);
  });
});

describe('attentionItems (round 5 A1, A4)', () => {
  const lanes = [{ name: 'web', state: 'done' }] as never;
  const done = { id: 'L', name: 'L', state: 'done', lanes } as unknown as LoopSummary;
  const release = { loopId: 'L', kind: 'release' as const, file: 'DONE.md', question: 'Release 0.4.0', bestGuess: '', since: '2026-10-12T00:00:00Z' };

  it('lists a waiting release once even when the inbox also has it (the banner said 2, the inbox 1)', () => {
    expect(needsYouCount([done], [release])).toBe(1);
    expect(attentionItems([done], [release]).map((i) => i.kind)).toEqual(['inbox']);
    expect(attentionItems([done], []).map((i) => i.kind)).toEqual(['release']);
  });

  it('a shipped release leaves the list', () => {
    const shipped = { ...done, shipped: { version: '0.4.0', date: '2026-10-13', npm: 'latest' } } as LoopSummary;
    expect(releaseWaiting(shipped)).toBe(false);
    expect(needsYouCount([shipped], [])).toBe(0);
  });

  it('keeps blocked-lane de-duplication and failing loops', () => {
    const blocked = { ...loop('blocked', [lane('a', 'blocked'), lane('b', 'stalled')]), id: 'B' };
    const question = { ...release, loopId: 'B', kind: 'question' as const };
    expect(attentionItems([blocked, { ...loop('failing'), id: 'F' }], [question]).map((i) => `${i.kind}:${i.loopId}`)).toEqual(['inbox:B', 'lane:B', 'failing:F']);
  });
});
