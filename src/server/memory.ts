import { readFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildEvalReport, dependencyMajors, matchRecipes, parseRecipe, parseResults, parseTriggerLog, parseTriggers, splitRecipe, summarizeRecipe, triggerStats } from '../core/parse/index.js';
import type { Recipe } from '../core/parse/index.js';
import type { EvalReportData, KnowledgeEntryInfo, KnowledgeReport, RecipeSummary, TriggerInfo } from '../core/types.js';

/**
 * Round 6 E1: the data behind the Knowledge & recipes and Eval screens.
 * Parsing, matching and the eval table are core's (`src/core`); this file only finds the files, hides home paths
 * and shapes the API. A malformed file is skipped, never an error.
 */

export const EVAL_COMMAND = 'loop eval run --task calc-page --arm both';

const readOptional = (file: string) => readFile(file, 'utf8').catch(() => undefined);

/** Shows the home folder as `~` so a path in the API never reveals the user's account name. */
export function displayPath(file: string, home: string = os.homedir()): string {
  const relative = path.relative(home, file);
  const inside = relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
  return inside ? `~/${relative.split(path.sep).join('/')}` : file.split(path.sep).join('/');
}

const count = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0);

interface StoredRecipe {
  recipe: Recipe;
  summary: RecipeSummary;
}

/** `*.md` recipe files of one folder, drafts (`*.draft.md`) excluded. Missing folder → none. */
export async function readRecipeStore(dir: string, store: 'project' | 'user', label: (file: string) => string): Promise<StoredRecipe[]> {
  const names = (await readdir(dir).catch(() => [])).filter((n) => n.endsWith('.md') && !n.endsWith('.draft.md')).sort();
  const stored: StoredRecipe[] = [];
  for (const name of names) {
    const file = path.join(dir, name);
    const recipe = parseRecipe((await readOptional(file)) ?? '');
    if (recipe) stored.push({ recipe, summary: summarizeRecipe(recipe, store, label(file)) });
  }
  return stored;
}

/** The user's cross-project store: `$LOOP_HOME/recipes` or `~/.ai/recipes`. */
export function userRecipeDir(env: NodeJS.ProcessEnv = process.env, home: string = os.homedir()): string {
  return path.join(env.LOOP_HOME ?? path.join(home, '.ai'), 'recipes');
}

/** The path a client may see for a user-store file: under the home folder `~/...`, else `$LOOP_HOME/...`; never an absolute path. */
function userLabel(home: string | undefined): (file: string) => string {
  return (file) => {
    const shown = displayPath(file, home);
    return shown.startsWith('~/') ? shown : `$LOOP_HOME/recipes/${path.basename(file)}`;
  };
}

/** Project recipes of the given clones (paths relative to the clone), then the user's store; a duplicate id keeps the first. */
export async function readRecipeEntries(loopDirs: readonly string[], userDir: string = userRecipeDir(), home?: string): Promise<StoredRecipe[]> {
  const found = [
    ...(await Promise.all(loopDirs.map((dir) => readRecipeStore(path.join(dir, '.ai', 'recipes'), 'project', (file) => path.relative(dir, file).split(path.sep).join('/'))))).flat(),
    ...(await readRecipeStore(userDir, 'user', userLabel(home))),
  ];
  return found.filter((r, i) => found.findIndex((o) => o.summary.id === r.summary.id) === i);
}

/** `GET /api/recipes`. */
export async function readRecipes(loopDirs: readonly string[], userDir?: string, home?: string): Promise<RecipeSummary[]> {
  return (await readRecipeEntries(loopDirs, userDir, home)).map((r) => r.summary);
}

/** Triggers of `.ai/triggers.yaml` (method C.5) with fired counts from the log; invalid entries are core's `problems`, skipped here. */
export function readTriggers(triggersYaml: string | undefined, log: string | undefined): TriggerInfo[] {
  const fired = new Map(triggerStats([], parseTriggerLog(log ?? '')).map((s) => [s.id, s.fired]));
  return parseTriggers(triggersYaml ?? '').triggers.map((t) => {
    const entry = /\bK-\d+\b/.exec(t.inject)?.[0];
    return { id: t.id, kinds: [t.on], fired: fired.get(t.id) ?? 0, ...(entry && { entry }) };
  });
}

/** Index entries joined with their trigger ids and fired counts. */
export async function readKnowledgeEntries(dir: string, triggers: readonly TriggerInfo[]): Promise<KnowledgeEntryInfo[]> {
  const knowledgeDir = path.join(dir, '.ai', 'knowledge');
  const names = (await readdir(knowledgeDir).catch(() => [])).filter((n) => /^K-\d+\.md$/.test(n)).sort();
  const lessons = new Map<string, string>();
  for (const line of (await readOptional(path.join(dir, '.ai', 'index.md')) ?? '').split(/\r?\n/)) {
    const match = /^(K-\d+)\s*·\s*(.*)$/.exec(line.trim());
    if (match?.[1]) lessons.set(match[1], (match[2] ?? '').split(' · ').slice(1).join(' · ') || (match[2] ?? ''));
  }
  const entries: KnowledgeEntryInfo[] = [];
  for (const name of names) {
    const parsed = splitRecipe((await readOptional(path.join(knowledgeDir, name))) ?? '');
    const id = name.replace(/\.md$/, '');
    if (!parsed) continue;
    const mine = triggers.filter((t) => t.id === id || t.entry === id);
    const firstLine = parsed.body.trim().split(/\r?\n/)[0] ?? id;
    entries.push({
      id,
      title: lessons.get(id) ?? firstLine,
      status: String(parsed.data.status).toLowerCase() === 'guess' ? 'guess' : 'confirmed',
      fired: mine.length > 0 ? mine.reduce((sum, t) => sum + t.fired, 0) : count(parsed.data.fired),
      triggerIds: mine.map((t) => t.id),
    });
  }
  return entries;
}

/** `GET /api/loops/:id/knowledge` for one clone; `recipes` are the stores' recipes, matched to the clone's package.json. */
export async function readKnowledge(dir: string, recipes: readonly StoredRecipe[]): Promise<KnowledgeReport> {
  const triggers = readTriggers(await readOptional(path.join(dir, '.ai', 'triggers.yaml')), await readOptional(path.join(dir, '.ai', '.trigger-log.jsonl')));
  const byId = new Map(recipes.map((r) => [r.recipe.id, r.summary]));
  const matches = matchRecipes(recipes.map((r) => r.recipe), dependencyMajors(await readOptional(path.join(dir, 'package.json'))));
  return {
    entries: await readKnowledgeEntries(dir, triggers),
    triggers,
    recipes: matches.flatMap((m) => {
      const summary = byId.get(m.recipe.id);
      return summary ? [{ ...summary, match: { score: m.score, reason: m.reason } }] : [];
    }),
  };
}

/** `GET /api/eval` for the given result folders: the newest `.jsonl` of each, merged. No results → empty rows and no headline. */
export async function readEval(resultDirs: readonly string[]): Promise<EvalReportData> {
  const text: string[] = [];
  for (const dir of resultDirs) {
    const newest = (await readdir(dir).catch(() => [])).filter((n) => n.endsWith('.jsonl')).sort().at(-1);
    if (newest) text.push((await readOptional(path.join(dir, newest))) ?? '');
  }
  const { rows, headline } = buildEvalReport(parseResults(text.join('\n')));
  return { rows, ...(headline && { headline }), sample: false, command: EVAL_COMMAND };
}
