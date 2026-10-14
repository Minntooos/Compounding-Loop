import { describe, expect, it } from 'vitest';
import { capPercent, firedText, looseTriggers, recipeContextCommand, secondsText, tokensText, trackRecord, triggersOf } from '../../../web/src/lib/knowledge.js';

const entry = { id: 'K-1', title: 't', status: 'confirmed' as const, fired: 2, triggerIds: ['T-a', 'T-gone'] };
const triggers = [{ id: 'T-a', kinds: ['error'], fired: 2, entry: 'K-1' }, { id: 'T-b', kinds: ['file'], fired: 0 }];

describe('knowledge helpers', () => {
  it('builds the copy command', () => expect(recipeContextCommand('R-x')).toBe('loop recipe show R-x --context'));
  it('quotes an id with shell characters', () => expect(recipeContextCommand('a b;rm')).toBe("loop recipe show 'a b;rm' --context"));
  it('words a fired count', () => { expect(firedText(0)).toBe('never fired'); expect(firedText(1)).toBe('fired once'); expect(firedText(4)).toBe('fired 4 times'); });
  it('keeps an unknown trigger id as a bare badge', () => expect(triggersOf(entry, triggers).map((t: { id: string }) => t.id)).toEqual(['T-a', 'T-gone']));
  it('lists triggers no entry points at', () => expect(looseTriggers(triggers, [entry]).map((t: { id: string }) => t.id)).toEqual(['T-b']));
  it('caps the size bar at 100%', () => { expect(capPercent(3072)).toBe(50); expect(capPercent(9000)).toBe(100); });
  it('words a track record', () => { expect(trackRecord({ uses: 0, passes: 0 })).toBe('not used yet'); expect(trackRecord({ uses: 3, passes: 2 })).toBe('2 of 3 passed'); });
  it('shortens tokens and time', () => { expect(tokensText(96000)).toBe('96k'); expect(tokensText(4200)).toBe('4.2k'); expect(tokensText(800)).toBe('800'); expect(secondsText(190)).toBe('3 min'); expect(secondsText(45)).toBe('45 s'); });
});
