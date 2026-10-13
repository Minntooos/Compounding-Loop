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

/** Why Release is off ("Release is off · <first failing ship check> · <its detail>"); undefined when it can be pressed. Adds no colon of its own (A8). */
export function releaseBlocker(loop: Pick<LoopDetail, 'ship'>): string | undefined {
  if (!loop.ship) return 'Release is off until the round is done (root DONE.md).';
  if (loop.ship.ready) return undefined;
  const first = loop.ship.items.find((i) => !i.ok);
  return first ? `Release is off · ${first.label} · ${first.detail.replace(/\.$/, '')}` : 'Release is off until every ship check passes.';
}
