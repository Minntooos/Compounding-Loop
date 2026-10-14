import type { EvalRow, KnowledgeEntryInfo, RecipeSummary, TriggerInfo } from '../../../src/core/types.js';

/** The command the copy button puts on the clipboard: the recipe as context for a Claude Code session. */
export const recipeContextCommand = (id: string): string => `loop recipe show ${/^[\w.@+-]+$/.test(id) ? id : `'${id.replace(/'/g, `'\\''`)}'`} --context`;

/** "fired 4 times" / "never fired": a trigger count in words, so a zero is stated rather than left blank. */
export function firedText(n: number): string {
  if (n <= 0) return 'never fired';
  return n === 1 ? 'fired once' : `fired ${n} times`;
}

/** The trigger objects an entry's `triggerIds` point at; an id with no matching trigger is kept as a bare id. */
export function triggersOf(entry: KnowledgeEntryInfo, triggers: TriggerInfo[]): TriggerInfo[] {
  return entry.triggerIds.map((id) => triggers.find((t) => t.id === id) ?? { id, kinds: [], fired: 0, entry: entry.id });
}

/** Triggers that inject no index entry (they point at a recipe or a file), shown after the entries. */
export const looseTriggers = (triggers: TriggerInfo[], entries: KnowledgeEntryInfo[]): TriggerInfo[] =>
  triggers.filter((t) => !entries.some((e) => e.triggerIds.includes(t.id)));

/** Fraction of the 6144-byte recipe cap in use, as a whole percent. */
export const capPercent = (bytes: number): number => Math.min(100, Math.round((bytes / 6144) * 100));

/** "3 of 5 passed" for a recipe's track record; "not used yet" with no uses. */
export const trackRecord = (r: Pick<RecipeSummary, 'uses' | 'passes'>): string =>
  r.uses === 0 ? 'not used yet' : `${r.passes} of ${r.uses} passed`;

export const ARM_LABEL: Record<EvalRow['arm'], string> = { cold: 'Cold', recipe: 'Recipe', 'recipe+triggers': 'Recipe + triggers' };

/** Median tokens as "96k"; small numbers stay whole. */
export const tokensText = (n: number): string => (n >= 10_000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

export const secondsText = (s: number): string => (s >= 120 ? `${Math.round(s / 60)} min` : `${Math.round(s)} s`);
