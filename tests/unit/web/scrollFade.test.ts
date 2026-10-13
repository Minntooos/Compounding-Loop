import { describe, expect, it } from 'vitest';
import { fadeEdges, fadeMask } from '../../../web/src/lib/scrollFade.js';

describe('tab row edge fade (round 5 A6)', () => {
  it('fades only the edges that hide more tabs', () => {
    expect(fadeEdges(0, 375, 375)).toEqual({ start: false, end: false });
    expect(fadeEdges(0, 375, 600)).toEqual({ start: false, end: true });
    expect(fadeEdges(100, 375, 600)).toEqual({ start: true, end: true });
    expect(fadeEdges(225, 375, 600)).toEqual({ start: true, end: false });
    expect(fadeEdges(0.5, 375, 375.6)).toEqual({ start: false, end: false });
  });
  it('builds no mask when everything fits, else a 24 px gradient on the hidden side', () => {
    expect(fadeMask({ start: false, end: false })).toBeUndefined();
    expect(fadeMask({ start: false, end: true })).toBe('linear-gradient(to right, #000 0, #000 calc(100% - 24px), transparent 100%)');
    expect(fadeMask({ start: true, end: false })).toBe('linear-gradient(to right, transparent 0, #000 24px, #000 100%)');
  });
});
