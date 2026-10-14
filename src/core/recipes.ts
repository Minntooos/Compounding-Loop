// Recipes (IDEA.md Round 6 A): one small Markdown file per repeatable procedure. Pure and browser-safe.
import { parse as parseYaml } from 'yaml';
import type { RecipeSummary } from './types.js';

export const RECIPE_CAP_BYTES = 6144;
export const RECIPE_SECTIONS = ['When to use', 'Steps', 'Traps', 'Checks', 'Start from'] as const;
export const RECIPE_FIELDS = ['id', 'title', 'kind', 'stack', 'tags', 'status', 'source', 'uses', 'passes', 'updated'] as const;

export interface Recipe {
  id: string;
  title: string;
  kind: 'project' | 'feature';
  /** `name@major` items. */
  stack: string[];
  tags: string[];
  status: 'CONFIRMED' | 'GUESS';
  source: string;
  uses: number;
  passes: number;
  updated: string;
  /** Everything after the front matter, untouched. */
  body: string;
  /** Section name → its lines (heading excluded). */
  sections: Record<string, string[]>;
  bytes: number;
}

/** Splits `---` front matter from the body; undefined when there is none or it is not a YAML mapping. */
export function splitRecipe(text: string): { data: Record<string, unknown>; body: string } | undefined {
  const m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text.replace(/^﻿/, ''));
  if (!m) return undefined;
  try {
    const data: unknown = parseYaml(m[1] ?? '');
    if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined;
    return { data: data as Record<string, unknown>, body: text.slice(text.indexOf(m[0]) + m[0].length) };
  } catch {
    return undefined;
  }
}

const sectionsOf = (body: string): Record<string, string[]> => {
  const out: Record<string, string[]> = {};
  let current: string[] | undefined;
  for (const line of body.split(/\r?\n/)) {
    const h = /^##\s+(.+?)\s*$/.exec(line);
    if (h) out[h[1] ?? ''] = current = [];
    else current?.push(line);
  }
  return out;
};

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const whole = (v: unknown): number => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0);
const isStep = (line: string): boolean => /^\s*\d+[.)]\s/.test(line);
const isItem = (line: string): boolean => /^\s*(?:[-*]|\d+[.)])\s/.test(line);

/** Reads a recipe leniently; undefined without a usable id and title. `checkRecipe` says what is wrong with it. */
export function parseRecipe(text: string): Recipe | undefined {
  const parts = splitRecipe(text);
  if (!parts || typeof parts.data.id !== 'string' || typeof parts.data.title !== 'string') return undefined;
  const { data, body } = parts;
  return {
    id: data.id as string,
    title: data.title as string,
    kind: data.kind === 'feature' ? 'feature' : 'project',
    stack: strings(data.stack),
    tags: strings(data.tags),
    status: data.status === 'GUESS' ? 'GUESS' : 'CONFIRMED',
    source: typeof data.source === 'string' ? data.source : '',
    uses: whole(data.uses),
    passes: whole(data.passes),
    updated: data.updated instanceof Date ? data.updated.toISOString().slice(0, 10) : String(data.updated ?? ''),
    body,
    sections: sectionsOf(body),
    bytes: new TextEncoder().encode(text).length,
  };
}

export const stepsOf = (r: Recipe): string[] => (r.sections.Steps ?? []).filter(isStep);
export const checksOf = (r: Recipe): string[] => (r.sections.Checks ?? []).filter(isItem);

/** The card shape the dashboard uses. */
export const summarizeRecipe = (r: Recipe, store: 'project' | 'user', displayedPath: string): RecipeSummary => ({
  id: r.id, title: r.title, kind: r.kind, stack: r.stack, tags: r.tags, status: r.status, uses: r.uses, passes: r.passes,
  steps: stepsOf(r).length, checks: checksOf(r).length, bytes: r.bytes, store, path: displayedPath,
});

/** The block a model receives: front matter dropped, sections kept. */
export function recipeContext(text: string): string {
  const parts = splitRecipe(text);
  return (parts ? parts.body : text).replace(/^\s+/, '').trimEnd() + '\n';
}

const SECRET = /\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,})/;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+[A-Za-z]/;
const ABS_PATH = /(?:^|[\s`'"(])(?:\/(?:home|Users|root|tmp|var|etc)\/|[A-Za-z]:\\)/;

/** Lint messages with a fix for each; empty means the recipe is valid. */
export function checkRecipe(text: string): string[] {
  const problems: string[] = [];
  const parts = splitRecipe(text);
  if (!parts) return ['No YAML front matter. Start the file with a --- block holding ' + RECIPE_FIELDS.join(', ') + '.'];
  const { data } = parts;
  for (const field of RECIPE_FIELDS) if (data[field] === undefined || data[field] === null) problems.push(`Front matter is missing "${field}". Add it.`);
  if (typeof data.id === 'string' && !/^R-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.id)) problems.push(`id "${data.id}" must look like R-<slug> (lowercase letters, digits, hyphens).`);
  if (data.kind !== undefined && data.kind !== 'project' && data.kind !== 'feature') problems.push('kind must be "project" or "feature".');
  if (data.status !== undefined && data.status !== 'CONFIRMED' && data.status !== 'GUESS') problems.push('status must be CONFIRMED or GUESS.');
  for (const field of ['stack', 'tags'] as const) if (data[field] !== undefined && !Array.isArray(data[field])) problems.push(`${field} must be a list.`);
  for (const item of strings(data.stack)) if (!/^[^@\s]+@\d+$/.test(item)) problems.push(`stack item "${item}" must look like name@major, e.g. node@20.`);
  for (const field of ['uses', 'passes'] as const) if (data[field] !== undefined && whole(data[field]) !== data[field]) problems.push(`${field} must be a whole number, 0 or more.`);
  const recipe = parseRecipe(text);
  if (recipe) {
    const names = Object.keys(recipe.sections);
    for (const section of RECIPE_SECTIONS) if (!names.includes(section)) problems.push(`Missing section "## ${section}". Add it.`);
    const present = RECIPE_SECTIONS.filter((s) => names.includes(s));
    if (present.join('|') !== names.filter((n) => (RECIPE_SECTIONS as readonly string[]).includes(n)).join('|')) problems.push(`Sections are out of order. Use: ${RECIPE_SECTIONS.join(', ')}.`);
    const steps = stepsOf(recipe);
    if (names.includes('Steps') && steps.length === 0) problems.push('"## Steps" has no numbered steps. Number them "1. ...".');
    steps.forEach((step, i) => {
      if (!/`[^`]+`/.test(step)) problems.push(`Step ${i + 1} names no command or test that proves it. Add the proof in backticks, e.g. "(proof: \`npm test\`)".`);
    });
    if (names.includes('Checks') && checksOf(recipe).length === 0) problems.push('"## Checks" lists no commands. Add one bullet per command that decides done.');
  }
  const bytes = new TextEncoder().encode(text).length;
  if (bytes > RECIPE_CAP_BYTES) problems.push(`Recipe is ${bytes} bytes; the cap is ${RECIPE_CAP_BYTES}. Cut the least useful steps or traps.`);
  if (ABS_PATH.test(text)) problems.push('Contains an absolute path. Use a path relative to the repo or ~.');
  if (EMAIL.test(text.replace(/`[^`\n]*@\d+[^`\n]*`/g, ''))) problems.push('Contains an email address. Remove it.');
  if (SECRET.test(text)) problems.push('Contains a token-like string. Remove it; recipes hold no secrets.');
  return problems;
}

/** Dependency name → major version from a package.json text (`^4.2.1` → `4`); `engines.node` gives `node`. */
export function dependencyMajors(packageJson: string | undefined): Record<string, string> {
  const majors: Record<string, string> = {};
  if (packageJson === undefined) return majors;
  try {
    const pkg = JSON.parse(packageJson) as Record<string, unknown>;
    const node = /(\d+)/.exec(String((pkg.engines as { node?: string } | undefined)?.node ?? ''))?.[1];
    if (node) majors.node = node;
    for (const field of ['dependencies', 'devDependencies']) {
      const group = pkg[field];
      if (typeof group !== 'object' || group === null) continue;
      for (const [name, range] of Object.entries(group)) {
        const major = /(\d+)/.exec(String(range))?.[1];
        if (major) majors[name] = major;
      }
    }
  } catch {
    // not JSON: no dependencies
  }
  return majors;
}

export interface RecipeMatch {
  recipe: Recipe;
  score: number;
  /** e.g. "stack 3/4, tags: calculator, static". */
  reason: string;
}

const words = (text: string): Set<string> => new Set(text.toLowerCase().match(/[a-z0-9]+/g) ?? []);

/**
 * Ranks recipes: +1 per stack item whose name and major match, -1 per name with another major, +1 per tag found in the task text.
 * Zero and negative scores drop out; ties go to more passes, then id.
 */
export function matchRecipes(recipes: readonly Recipe[], deps: Readonly<Record<string, string>>, task = ''): RecipeMatch[] {
  const taskWords = words(task);
  const out: RecipeMatch[] = [];
  for (const recipe of recipes) {
    let matched = 0;
    const mismatched: string[] = [];
    for (const item of recipe.stack) {
      const [name = '', major] = item.split('@');
      const have = deps[name];
      if (have === undefined) continue;
      if (have === major) matched++;
      else mismatched.push(name);
    }
    const tags = recipe.tags.filter((t) => [...words(t)].every((w) => taskWords.has(w)) && words(t).size > 0);
    const score = matched - mismatched.length + tags.length;
    if (score <= 0) continue;
    const reason = [`stack ${matched}/${recipe.stack.length}`, ...(mismatched.length ? [`major differs: ${mismatched.join(', ')}`] : []), ...(tags.length ? [`tags: ${tags.join(', ')}`] : [])].join(', ');
    out.push({ recipe, score, reason });
  }
  return out.sort((a, b) => b.score - a.score || b.recipe.passes - a.recipe.passes || a.recipe.id.localeCompare(b.recipe.id));
}
