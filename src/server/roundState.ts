// Pure (no Node imports): what a root DONE.md means for the dashboard. The round is finished and a release waits
// for the owner, so the loop is "done" but must not read as "nothing needs you".
import type { InboxItem } from '../core/types.js';

export interface RoundFacts {
  /** The round in progress, or the one that just finished when `hasDone`. */
  round: number;
  /** Root DONE.md exists. */
  hasDone: boolean;
  /** The loop has lanes: only those repos are released by the owner, a finished site loop is just finished. */
  laned: boolean;
  /** `version` from the repo's package.json, when it has one. */
  version?: string;
}

export interface RoundState {
  /** "Round 3 done · 0.3.0" or "Round 4". */
  roundLabel: string;
  releaseWaiting: boolean;
}

/** `version` of a package.json text; undefined when the text is not JSON or has no string version. */
export function packageVersion(packageJson: string | undefined): string | undefined {
  if (packageJson === undefined) return undefined;
  try {
    const version = (JSON.parse(packageJson) as { version?: unknown }).version;
    return typeof version === 'string' && version !== '' ? version : undefined;
  } catch {
    return undefined;
  }
}

export function roundState({ round, hasDone, laned, version }: RoundFacts): RoundState {
  return { roundLabel: hasDone ? `Round ${round} done${version ? ` · ${version}` : ''}` : `Round ${round}`, releaseWaiting: hasDone && laned };
}

/** The attention-list entry for a waiting release; `kind: 'release'` tells the UI not to offer an answer form. */
export function releaseInboxItem(loopId: string, version: string | undefined, since: string): InboxItem {
  return {
    loopId,
    file: 'DONE.md',
    kind: 'release',
    question: version ? `Release ${version} is waiting on you` : 'A release is waiting on you',
    bestGuess: 'Check "Ready to ship", then run the Release workflow',
    since,
  };
}
