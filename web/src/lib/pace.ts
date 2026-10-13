import { PACES, PACE_SUMMARY } from '../../../src/core/parse/policy.js';
import type { LoopDetail, Pace, Policy } from '../../../src/core/types.js';
import { paceEditText, paceEditUrl } from '../../../src/server/controls.js';

export { PACES, PACE_SUMMARY, paceEditUrl };

export type LoopPace = NonNullable<LoopDetail['pace']>;

export const PACE_WORD: Record<Pace, string> = { careful: 'Careful', balanced: 'Balanced', fast: 'Fast', sprint: 'Sprint' };

/** The floor every preset keeps (IDEA.md Round 5 B7), said once under the four choices. */
export const PACE_FLOOR = 'Every pace: never push with a failing check; CI runs on every push.';

/** The auto-downshift rule (IDEA.md Round 5 B7), until core or server report an actual downshift. */
export const PACE_DOWNSHIFT = 'If CI on main is red twice in 24 h, the control room sets the pace back to Balanced and says why.';

/** The pace a lane runs at, and whether that is its own override (core's `paceFor`, on the server's shape). */
export function lanePace(pace: LoopPace, lane: string): { pace: Pace; own: boolean } {
  const own = pace.overrides[lane];
  return own ? { pace: own, own: true } : { pace: pace.pace, own: false };
}

/** The lane row's pace words, only when the lane does not simply follow the loop: "Pace: Careful (own)". */
export function lanePaceText(pace: LoopPace, lane: string): string | undefined {
  const p = lanePace(pace, lane);
  return p.own && p.pace !== pace.pace ? `Pace: ${PACE_WORD[p.pace]} (own)` : undefined;
}

/** `LoopDetail.pace` back as the `policy.json` shape, for the demo's file text. */
export function policyOf(pace: LoopPace): Policy {
  return { version: 1, pace: pace.pace, lanes: Object.fromEntries(Object.entries(pace.overrides).map(([lane, p]) => [lane, { pace: p }])) };
}

/** The whole new `policy.json` text the demo copies (the format `loop pace set` writes). */
export function paceFileText(pace: LoopPace, next: Pace, lane?: string): string {
  return paceEditText(policyOf(pace), next, lane);
}

/** The toast after a local save; `changed: false` means the file already said so. */
export function paceToast(next: Pace, lane: string | undefined, changed: boolean, loopPace: Pace): string {
  if (!lane) return changed ? `Loop pace is now ${next}, from each lane's next run (lanes with their own pace keep it)` : `Loop pace is already ${next}`;
  if (!changed) return `${lane} already runs at ${next}`;
  return `${lane} now runs at ${next}${next === loopPace ? ' (same as the loop)' : ''} from its next run`;
}
