import { formatSteerEntry, steerPath } from '../../../src/core/parse/steer.js';
import type { SteerScope } from '../../../src/core/types.js';
import { editFileUrl, newFileUrl } from '../../../src/server/controls.js';

export interface SteerDraftInput {
  lane: string;
  /** Unit number or name from the lane's task file; the entry format has no unit field, so it leads the text. */
  unit?: string;
  scope: SteerScope;
  text: string;
  author: string;
  at: Date;
}

/** The text that goes under the heading: "Unit 4: …" for a unit scope, the typed text otherwise. */
export function steerText(unit: string | undefined, text: string): string {
  const body = text.trim();
  const u = unit?.trim().replace(/^unit\s+/i, '');
  return u && body ? `Unit ${u}: ${body}` : body;
}

/** The file and the exact entry core's formatter writes; the preview shows this and nothing re-implemented. */
export function steerDraft(input: SteerDraftInput): { path: string; entry: string } {
  return { path: steerPath(input.lane), entry: formatSteerEntry({ at: input.at, author: input.author, scope: input.scope, text: steerText(input.unit, input.text) }) };
}

/** One POSIX shell word (bash, zsh): bare when it is plain, else single-quoted, where nothing expands (`!`, `$`, backticks). */
export function shellWord(word: string): string {
  return /^[\w.,:/@%+=][\w.,:/@%+=-]*$/.test(word) ? word : `'${word.replace(/'/g, `'\\''`)}'`;
}

/** `loop steer` for a local loop. Options come first and `--` ends them, so text starting with "-" stays text; newlines stay inside the quotes. */
export function steerCommand(input: Pick<SteerDraftInput, 'lane' | 'unit' | 'scope' | 'text'> & { author?: string }): string {
  const options = [...(input.scope === 'standing' ? ['--standing'] : []), ...(input.author?.trim() ? ['--author', shellWord(input.author.trim())] : [])];
  return ['npx', 'compounding-loop', 'steer', ...options, '--', shellWord(input.lane), shellWord(steerText(input.unit, input.text))].join(' ');
}

/** GitHub's editor for the lane's steer.md. GitHub cannot prefill an edit, so the dialog copies the entry first. */
export const steerEditUrl = (slug: string, lane: string): string => editFileUrl(slug, steerPath(lane));

/** GitHub's new-file page with the entry prefilled, for a loop whose lane has no steer.md yet; undefined when too long for a URL. */
export function steerNewFileUrl(slug: string, lane: string, entry: string): string | undefined {
  try { return newFileUrl(slug, steerPath(lane), entry); } catch (e) { if (e instanceof RangeError) return undefined; throw e; }
}
