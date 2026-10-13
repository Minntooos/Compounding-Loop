import type { LoopDetail } from '../../../src/core/types.js';
import { briefFitsUrl, nextRoundUrl, pauseUrl, releaseWorkflowUrl, resumeUrl } from '../../../src/server/controls.js';
import { isRepoSlug } from '../../../src/server/live/urls.js';

export type ControlAction = 'pause' | 'resume' | 'next-round' | 'release';

/** "owner/repo" from a GitHub repo URL, undefined for anything else (a Pages site, a local path). */
export function slugOf(url: string | undefined): string | undefined {
  const m = /^https:\/\/github\.com\/([^/]+\/[^/#?]+?)(?:\.git)?\/?$/.exec(url ?? '');
  return m?.[1] && isRepoSlug(m[1]) ? m[1] : undefined;
}

/** What each action changes, in plain words, for the confirm step. */
export const CHANGE_TEXT: Record<ControlAction, string> = {
  pause: 'Adds .ai/PAUSED on main. All lane runs and the control room stop until you resume.',
  resume: 'Removes .ai/PAUSED from main. Lane runs and the control room continue on their next schedule.',
  'next-round': 'Adds .ai/next-round.md on main. A workflow then puts the brief first in IDEA.md, archives the DONE files, resets every lane and deletes the file.',
  release: 'Opens the release workflow. Nothing is published until you press Run workflow and the release environment is approved.',
};

export const VERB: Record<ControlAction, string> = { pause: 'Pause', resume: 'Resume', 'next-round': 'Start next round', release: 'Release' };

/** The prefilled GitHub page for an action on the static demo; undefined when the repo is unknown or the brief is too long for a URL. */
export function githubUrl(action: ControlAction, slug: string, opts: { brief?: string; reason?: string; now?: Date } = {}): string | undefined {
  switch (action) {
    case 'pause': return pauseUrl(slug, 'dashboard', opts.now ?? new Date(), opts.reason);
    case 'resume': return resumeUrl(slug);
    case 'release': return releaseWorkflowUrl(slug);
    case 'next-round': return opts.brief && briefFitsUrl(slug, opts.brief) ? nextRoundUrl(slug, opts.brief) : undefined;
  }
}

/** What Release waits for (the first failing ship-check item), for "Release is off until …"; undefined when it can be pressed. */
export function releaseBlocker(loop: Pick<LoopDetail, 'ship'>): string | undefined {
  if (!loop.ship) return 'the round is done (root DONE.md)';
  if (loop.ship.ready) return undefined;
  const first = loop.ship.items.find((i) => !i.ok);
  return first ? `${lowerFirst(first.label)} (${first.detail})` : 'every ship check passes';
}

/** "Tests pass" → "tests pass" mid-sentence; acronyms such as "CHANGELOG" or "CI" stay as they are. */
function lowerFirst(text: string): string {
  return /^[A-Z][a-z]/.test(text) ? text[0]!.toLowerCase() + text.slice(1) : text;
}
