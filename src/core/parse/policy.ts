// `.ai/policy.json`: how much checking a run does (IDEA.md Round 5 B7). Pure and browser-safe.
import type { Pace, Policy } from '../types.js';

export const POLICY_FILE = '.ai/policy.json';

export const PACES: readonly Pace[] = ['careful', 'balanced', 'fast', 'sprint'];
export const DEFAULT_PACE: Pace = 'balanced';

export const isPace = (value: unknown): value is Pace => typeof value === 'string' && (PACES as readonly string[]).includes(value);

export const emptyPolicy = (): Policy => ({ version: 1, pace: DEFAULT_PACE, lanes: {} });

/** One plain line per preset on what it skips; the floor (no push with a failing check, CI on every push) holds for all. */
export const PACE_SUMMARY: Record<Pace, string> = {
  careful: 'Full tests after every unit and before push; a reviewer on every unit; 40 minutes per run.',
  balanced: 'Related tests after each unit, full tests before push; one reviewer per run; 40 minutes.',
  fast: 'Like balanced, but a reviewer only for shared files or another lane\'s contract; 50 minutes.',
  sprint: 'Typecheck and lint per unit, unit tests before push, e2e once at the end; no reviewer; 50 minutes or 70% context.',
};

/** Reads a policy file. Anything unreadable, or any unknown preset, falls back to `balanced`. */
export function parsePolicy(text: string): Policy {
  try {
    const raw: unknown = JSON.parse(text);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyPolicy();
    const { pace, lanes } = raw as Record<string, unknown>;
    const overrides: Policy['lanes'] = {};
    if (lanes && typeof lanes === 'object' && !Array.isArray(lanes)) {
      for (const [lane, value] of Object.entries(lanes)) {
        const lanePace = value && typeof value === 'object' ? (value as Record<string, unknown>).pace : undefined;
        if (isPace(lanePace)) overrides[lane] = { pace: lanePace };
      }
    }
    return { version: 1, pace: isPace(pace) ? pace : DEFAULT_PACE, lanes: overrides };
  } catch {
    return emptyPolicy();
  }
}

export function formatPolicy(policy: Policy): string {
  const lanes = Object.entries(policy.lanes).map(([lane, e]) => `    ${JSON.stringify(lane)}: ${JSON.stringify(e)}`);
  return `{\n  "version": 1,\n  "pace": ${JSON.stringify(policy.pace)},\n  "lanes": {${lanes.length ? `\n${lanes.join(',\n')}\n  ` : ''}}\n}\n`;
}

/** The pace a lane runs at: its own override, else the global one. `lane` undefined (the control room) gets the global pace. */
export const paceFor = (policy: Policy, lane?: string): Pace => (lane !== undefined ? policy.lanes[lane]?.pace : undefined) ?? policy.pace;

/** The policy after setting the global pace (no lane) or one lane's override. */
export function withPace(policy: Policy, pace: Pace, lane?: string): Policy {
  return lane === undefined ? { ...policy, pace } : { ...policy, lanes: { ...policy.lanes, [lane]: { pace } } };
}
