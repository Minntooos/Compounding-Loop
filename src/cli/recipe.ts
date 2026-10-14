import { copyFile, mkdir, readFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { checkRecipe, dependencyMajors, matchRecipes, parseRecipe, recipeContext, summarizeRecipe, type Recipe, type RecipeMatch } from '../core/recipes.js';
import type { RecipeSummary } from '../core/types.js';

/** The user's cross-project folder: `LOOP_HOME` (tests) or `~/.ai`. */
export const loopHome = (env: NodeJS.ProcessEnv = process.env): string => env.LOOP_HOME || path.join(os.homedir(), '.ai');

export interface StoredRecipe {
  recipe: Recipe;
  text: string;
  store: 'project' | 'user';
  /** Display path: relative to the repo, or `~/…` for the user store. */
  path: string;
}

const storeDirs = (dir: string): { store: 'project' | 'user'; abs: string; label: (file: string) => string }[] => [
  { store: 'project', abs: path.join(dir, '.ai', 'recipes'), label: (f) => `.ai/recipes/${f}` },
  { store: 'user', abs: path.join(loopHome(), 'recipes'), label: (f) => `~/.ai/recipes/${f}` },
];

/** Every usable recipe in both stores, project first; drafts (`*.draft.md`) and unreadable files are skipped. */
export async function readStores(dir: string): Promise<StoredRecipe[]> {
  const found: StoredRecipe[] = [];
  for (const { store, abs, label } of storeDirs(dir)) {
    const names = (await readdir(abs).catch(() => [])).filter((n) => n.endsWith('.md') && !n.endsWith('.draft.md')).sort();
    for (const name of names) {
      const text = await readFile(path.join(abs, name), 'utf8').catch(() => undefined);
      const recipe = text === undefined ? undefined : parseRecipe(text);
      if (text !== undefined && recipe) found.push({ recipe, text, store, path: label(name) });
    }
  }
  return found;
}

export const listRecipes = async (dir: string): Promise<RecipeSummary[]> => (await readStores(dir)).map((s) => summarizeRecipe(s.recipe, s.store, s.path));

export async function findRecipe(dir: string, id: string): Promise<StoredRecipe> {
  const stored = await readStores(dir);
  const hit = stored.find((s) => s.recipe.id === id) ?? stored.find((s) => s.recipe.id === `R-${id}`);
  if (!hit) throw new Error(`No recipe "${id}". Run \`loop recipe list\` to see the ids.`);
  return hit;
}

/** `loop recipe show <id> --context`: exactly what a model receives. */
export async function showRecipe(dir: string, id: string, context: boolean): Promise<string> {
  const hit = await findRecipe(dir, id);
  return context ? recipeContext(hit.text) : hit.text;
}

export interface RecipeMatchView {
  id: string;
  title: string;
  score: number;
  reason: string;
  store: 'project' | 'user';
  path: string;
}

/** Top recipes for this repo (stack from `package.json`) and an optional task text. */
export async function matchHere(dir: string, task = '', limit = 3): Promise<RecipeMatchView[]> {
  const stored = await readStores(dir);
  const deps = dependencyMajors(await readFile(path.join(dir, 'package.json'), 'utf8').catch(() => undefined));
  const byRecipe = new Map(stored.map((s) => [s.recipe, s]));
  return matchRecipes(stored.map((s) => s.recipe), deps, task)
    .slice(0, limit)
    .map((m: RecipeMatch) => {
      const s = byRecipe.get(m.recipe)!;
      return { id: m.recipe.id, title: m.recipe.title, score: m.score, reason: m.reason, store: s.store, path: s.path };
    });
}

export interface RecipeCheckResult {
  file: string;
  problems: string[];
}

/** Lints a file, or every recipe in the project store when no file is given. */
export async function checkRecipes(dir: string, file?: string): Promise<RecipeCheckResult[]> {
  if (file) {
    const text = await readFile(path.resolve(dir, file), 'utf8').catch(() => undefined);
    if (text === undefined) throw new Error(`Cannot read ${file}.`);
    return [{ file, problems: checkRecipe(text) }];
  }
  const abs = path.join(dir, '.ai', 'recipes');
  const names = (await readdir(abs).catch(() => [])).filter((n) => n.endsWith('.md')).sort();
  const results: RecipeCheckResult[] = [];
  for (const name of names) results.push({ file: `.ai/recipes/${name}`, problems: checkRecipe(await readFile(path.join(abs, name), 'utf8')) });
  return results;
}

/** `loop recipe add <file> [--global]`: copies a recipe that passes `check` into a store, named after its id. */
export async function addRecipe(dir: string, file: string, global = false): Promise<{ id: string; path: string }> {
  const text = await readFile(path.resolve(dir, file), 'utf8').catch(() => undefined);
  if (text === undefined) throw new Error(`Cannot read ${file}.`);
  const problems = checkRecipe(text);
  if (problems.length > 0) throw new Error(`${file} does not pass \`loop recipe check\`:\n- ${problems.join('\n- ')}`);
  const id = parseRecipe(text)!.id;
  const target = global ? path.join(loopHome(), 'recipes') : path.join(dir, '.ai', 'recipes');
  await mkdir(target, { recursive: true });
  await copyFile(path.resolve(dir, file), path.join(target, `${id}.md`));
  return { id, path: global ? `~/.ai/recipes/${id}.md` : `.ai/recipes/${id}.md` };
}

export function formatRecipeList(recipes: readonly RecipeSummary[]): string {
  if (recipes.length === 0) return 'No recipes yet. Add one with `loop recipe add <file>` or draft one with `loop recipe draft`.';
  return recipes.map((r) => `${r.id.padEnd(28)} ${r.status.padEnd(9)} ${String(r.steps).padStart(2)} steps ${String(r.checks).padStart(2)} checks  ${r.store}  ${r.title}`).join('\n');
}

export function formatMatches(matches: readonly RecipeMatchView[]): string {
  if (matches.length === 0) return 'No recipe matches this repo.';
  return matches.map((m) => `${m.id}  score ${m.score}  (${m.reason})  ${m.path}`).join('\n');
}
