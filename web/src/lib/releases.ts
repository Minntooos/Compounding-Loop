import type { LoopRelease } from '../../../src/core/types.js';

export type ChipTone = 'ok' | 'off' | 'unknown';

const NPM: Record<NonNullable<LoopRelease['npm']>, { label: string; tone: ChipTone }> = {
  latest: { label: 'npm latest', tone: 'ok' },
  published: { label: 'On npm', tone: 'ok' },
  'not-published': { label: 'Not on npm', tone: 'off' },
  unknown: { label: 'npm not checked', tone: 'unknown' },
};

/** Tag and npm chips for a Releases row (C7). A field the server did not check adds no chip, so nothing is implied. */
export function releaseChips(r: Pick<LoopRelease, 'tag' | 'npm'>): { label: string; tone: ChipTone }[] {
  const chips: { label: string; tone: ChipTone }[] = [];
  if (r.tag !== undefined) chips.push(r.tag ? { label: 'Tagged', tone: 'ok' } : { label: 'No tag', tone: 'off' });
  if (r.npm) chips.push(NPM[r.npm]);
  return chips;
}
