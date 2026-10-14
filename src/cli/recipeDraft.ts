import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseLanesConfig } from '../core/lanes.js';
import { sectionOf } from '../core/parse/task.js';
import { buildRecipeDraftPrompt } from '../core/recipeDraft.js';
import { checkRecipe, parseRecipe } from '../core/recipes.js';
import { draftClaudeArgs } from '../core/draftBrief.js';
import { realClaude, type ClaudeRunner } from './draft.js';
import { readStores } from './recipe.js';

const read = (file: string) => readFile(file, 'utf8').catch(() => undefined);

export interface RecipeDraftOptions {
  /** A lane name from `.ai/lanes.json`, or a folder (relative to the repo) holding another loop's `.ai/`. Default: the repo's own root files. */
  from?: string;
  id?: string;
  printPrompt?: boolean;
  model?: string;
  claude?: ClaudeRunner;
}

export interface RecipeDraftResult {
  prompt: string;
  /** Absent with `printPrompt`. */
  draft?: string;
  /** Repo-relative path of the written draft (absent with `printPrompt` and for a delta). */
  outFile?: string;
  problems?: string[];
  /** True when the answer is a delta for an existing id (printed, never written as a recipe file). */
  delta?: boolean;
}

/** The first `# ` or heading-less first line of a knowledge entry's body, after its front matter. */
const entryLine = (id: string, text: string): string => {
  const type = /^type:\s*(\S+)/m.exec(text)?.[1] ?? 'note';
  const body = text.replace(/^---[\s\S]*?\n---\s*/, '');
  const first = body.split(/\r?\n/).map((l) => l.replace(/^#+\s*/, '').trim()).find(Boolean) ?? '';
  return `${id} ${type}: ${first.slice(0, 160)}`;
};

/** Collects DONE.md, the task notes, knowledge entries and recent runs for the draft prompt. */
export async function gatherRecipePrompt(dir: string, options: RecipeDraftOptions = {}): Promise<string> {
  const lanes = parseLanesConfig((await read(path.join(dir, '.ai', 'lanes.json'))) ?? '').config?.lanes.map((l) => l.name) ?? [];
  const lane = options.from && lanes.includes(options.from) ? options.from : undefined;
  const base = options.from && !lane ? path.resolve(dir, options.from) : dir;
  if (options.from && !lane && !(await stat(base).then((s) => s.isDirectory(), () => false))) throw new Error(`--from "${options.from}" is neither a lane (${lanes.join(', ') || 'none here'}) nor a folder.`);
  if (path.relative(dir, base).startsWith('..')) throw new Error('--from must be a folder inside the repo.');
  const laneDir = lane ? path.join(base, '.ai', 'lanes', lane) : undefined;
  const done = await read(laneDir ? path.join(laneDir, 'DONE.md') : path.join(base, 'DONE.md'));
  const task = await read(laneDir ? path.join(laneDir, 'task.md') : path.join(base, '.ai', 'task.md'));
  const notes = ['Decisions', 'Tried', "Don't"].map((heading) => ({ heading, body: task ? (sectionOf(task, heading) ?? '') : '' }));
  const knowledgeDir = path.join(base, '.ai', 'knowledge');
  const knowledge: string[] = [];
  for (const name of (await readdir(knowledgeDir).catch(() => [] as string[])).filter((n) => n.endsWith('.md')).sort()) {
    knowledge.push(entryLine(name.replace(/\.md$/, ''), (await read(path.join(knowledgeDir, name))) ?? ''));
  }
  const runFiles = laneDir ? [path.join(laneDir, 'runs.jsonl')] : (lanes.length ? lanes : []).map((l) => path.join(base, '.ai', 'lanes', l, 'runs.jsonl'));
  const runs = (await Promise.all(runFiles.map(read))).flatMap((t) => (t ?? '').split(/\r?\n/).filter(Boolean)).slice(-10);
  const existingIds = (await readStores(dir)).map((s) => s.recipe.id);
  return buildRecipeDraftPrompt({ source: options.from ?? path.basename(dir), ...(done !== undefined && { done }), notes, knowledge, runs, existingIds, ...(options.id && { id: options.id }) });
}

/**
 * `loop recipe draft`: builds the prompt; without `--print-prompt` runs `claude -p`, writes `.ai/recipes/<id>.draft.md` and scores it.
 * An answer for an id that already exists is a delta: it is returned, not written over the recipe.
 */
export async function runRecipeDraft(dir: string, options: RecipeDraftOptions = {}): Promise<RecipeDraftResult> {
  const prompt = await gatherRecipePrompt(dir, options);
  if (options.printPrompt) return { prompt };
  const draft = (await (options.claude ?? realClaude)(draftClaudeArgs(prompt, options.model), dir)).trim();
  if (!draft) throw new Error('Claude returned an empty draft. Run again, or use --print-prompt and paste the prompt into Claude Code yourself.');
  const recipe = parseRecipe(draft);
  const existing = (await readStores(dir)).some((s) => s.recipe.id === (recipe?.id ?? options.id));
  if (!recipe || existing) return { prompt, draft, delta: existing, problems: recipe ? [] : checkRecipe(draft) };
  // The id becomes a file name: refuse anything but R-<slug> before touching the disk.
  if (!/^R-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(recipe.id)) return { prompt, draft, problems: checkRecipe(draft) };
  const rel = `.ai/recipes/${recipe.id}.draft.md`;
  await mkdir(path.join(dir, '.ai', 'recipes'), { recursive: true });
  await writeFile(path.join(dir, ...rel.split('/')), `${draft}\n`);
  return { prompt, draft, outFile: rel, problems: checkRecipe(draft) };
}
