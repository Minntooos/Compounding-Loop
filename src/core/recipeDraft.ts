// The prompt that asks Claude to draft a recipe from finished work (IDEA.md Round 6 A4). Pure: no Node imports.
import { RECIPE_CAP_BYTES, RECIPE_FIELDS, RECIPE_SECTIONS } from './recipes.js';

export interface RecipeDraftInputs {
  /** Where the work came from, shown to the model (a lane name or folder name; never an absolute path). */
  source: string;
  /** The finished work's DONE.md, if any. */
  done?: string;
  /** The task file's Decisions, Tried and Don't sections. */
  notes: { heading: string; body: string }[];
  /** One line per knowledge entry: `K-0001 gotcha: <title or first line>`. */
  knowledge: string[];
  /** Recent run-log lines (JSON), newest last. */
  runs: string[];
  /** Ids already in the stores. A draft for one of them is a delta. */
  existingIds: string[];
  /** A fixed id to use (for `--id`), or undefined to let Claude pick R-<slug>. */
  id?: string;
}

const clip = (text: string, max: number): string => (text.length <= max ? text : `${text.slice(0, max)}\n[…cut]`);
const block = (text: string | undefined, max: number): string => (text?.trim() ? clip(text.trim(), max) : '(none)');

export function buildRecipeDraftPrompt(input: RecipeDraftInputs): string {
  const notes = input.notes.filter((n) => n.body.trim()).map((n) => `### ${n.heading}\n${clip(n.body.trim(), 2000)}`).join('\n\n') || '(none)';
  const idRule = input.id
    ? `Use id "${input.id}".${input.existingIds.includes(input.id) ? ' It already exists: answer with a DELTA (below), not a full recipe.' : ''}`
    : 'Pick an id "R-<slug>" that is not in this list: ' + (input.existingIds.join(', ') || '(no recipes yet)') + '. If the work extends one of those, answer with a DELTA (below) for that id.';
  return `You are distilling a recipe from work that passed its checks in ${input.source}. A recipe is the smallest exact context that lets a smaller model repeat the procedure in one pass. Use only the inputs below; do not edit files or run commands. Answer with the recipe as Markdown and nothing else.

## Inputs

### DONE.md
${block(input.done, 3000)}

### Task notes
${notes}

### Knowledge entries
${input.knowledge.length ? input.knowledge.map((k) => `- ${k}`).join('\n') : '(none)'}

### Recent runs
${input.runs.length ? input.runs.slice(-10).join('\n') : '(none)'}

## Format (\`loop recipe check\` scores it; the draft is refused above ${RECIPE_CAP_BYTES} bytes)
- YAML front matter between --- lines with: ${RECIPE_FIELDS.join(', ')}. \`kind\` is project or feature; \`stack\` lists name@major (e.g. node@20); \`status\` is GUESS unless the checks of this very work proved it; \`source\` is the repo and commit; \`uses\` and \`passes\` start at 0; \`updated\` is today's date.
- Then "# <title>" and these sections, in this order: ${RECIPE_SECTIONS.map((s) => `"## ${s}"`).join(', ')}.
- Steps are numbered and each one ends with the command or test that proves it in backticks. Traps are one line each and cite the knowledge id or trigger that covers them. Checks are the commands that decide done. Start from names templates or files to copy.
- Keep only what a repeat of this work needs. No absolute paths, emails or secrets. Do not describe what happened; describe what to do.
- ${idRule}

## Delta rule (ACE)
If the id already exists, do not rewrite the recipe. Answer only with a list under the headings "### Add" and "### Change", one item per line, each with the section it belongs to and the evidence (a test, command or knowledge id). Never drop an existing item without evidence.
`;
}
