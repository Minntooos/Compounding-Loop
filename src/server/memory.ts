import { readFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { EvalReportData, EvalRow, KnowledgeEntryInfo, KnowledgeReport, RecipeSummary, TriggerInfo } from '../core/types.js';

/**
 * Round 6 E1: the data behind the Knowledge & recipes and Eval screens.
 * Core owns the real recipe/trigger/eval parsers; until they land this reads the files directly and tolerantly
 * (a malformed file is skipped, never an error), and the shapes are fixed by `src/core/types.ts`.
 */

export const RECIPE_CAP_BYTES = 6144;
export const EVAL_COMMAND = 'loop eval run --task calc-page --arm both';

const readOptional = (file: string) => readFile(file, 'utf8').catch(() => undefined);

/** Front matter (`---` fenced YAML) and the Markdown after it; undefined without valid front matter. */
export function splitFrontMatter(text: string): { data: Record<string, unknown>; body: string } | undefined {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!match) return undefined;
  try {
    const data: unknown = parseYaml(match[1] ?? '');
    return typeof data === 'object' && data !== null && !Array.isArray(data) ? { data: data as Record<string, unknown>, body: match[2] ?? '' } : undefined;
  } catch {
    return undefined;
  }
}

/** Shows the home folder as `~` so a path in the API never reveals the user's account name. */
export function displayPath(file: string, home: string = os.homedir()): string {
  const relative = path.relative(home, file);
  const inside = relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
  return inside ? `~/${relative.split(path.sep).join('/')}` : file.split(path.sep).join('/');
}

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []);
const count = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0);

/** The lines of `## <heading>` up to the next `## `. */
function sectionLines(body: string, heading: string): string[] {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((l) => new RegExp(`^##\\s+${heading}\\b`, 'i').test(l));
  if (start < 0) return [];
  const end = lines.findIndex((l, i) => i > start && /^##\s/.test(l));
  return lines.slice(start + 1, end < 0 ? undefined : end);
}

/** One recipe file as a card; undefined when it has no usable front matter (id and title). */
export function summarizeRecipe(text: string, store: 'project' | 'user', displayedPath: string): RecipeSummary | undefined {
  const parsed = splitFrontMatter(text);
  if (!parsed) return undefined;
  const { data, body } = parsed;
  if (typeof data.id !== 'string' || typeof data.title !== 'string') return undefined;
  return {
    id: data.id,
    title: data.title,
    kind: data.kind === 'feature' ? 'feature' : 'project',
    stack: strings(data.stack),
    tags: strings(data.tags),
    status: data.status === 'GUESS' ? 'GUESS' : 'CONFIRMED',
    uses: count(data.uses),
    passes: count(data.passes),
    steps: sectionLines(body, 'Steps').filter((l) => /^\s*\d+[.)]\s/.test(l)).length,
    checks: sectionLines(body, 'Checks').filter((l) => /^\s*(?:[-*]|\d+[.)])\s/.test(l)).length,
    bytes: Buffer.byteLength(text, 'utf8'),
    store,
    path: displayedPath,
  };
}

/** `name@major` entries of a recipe's stack against a project's dependency majors: shared names, minus major mismatches. */
export function stackOverlap(stack: readonly string[], deps: Readonly<Record<string, string>>): { matched: string[]; mismatched: string[] } {
  const matched: string[] = [];
  const mismatched: string[] = [];
  for (const item of stack) {
    const [name = '', major] = item.split('@');
    const have = deps[name];
    if (have === undefined) continue;
    (major === undefined || have === major ? matched : mismatched).push(name);
  }
  return { matched, mismatched };
}

/** Dependency name → major version from a package.json text (`^4.2.1` → `4`). */
export function dependencyMajors(packageJson: string | undefined): Record<string, string> {
  const majors: Record<string, string> = {};
  if (packageJson === undefined) return majors;
  try {
    const pkg = JSON.parse(packageJson) as Record<string, unknown>;
    const nodeEngine = /(\d+)/.exec(String((pkg.engines as { node?: string } | undefined)?.node ?? ''))?.[1];
    if (nodeEngine) majors.node = nodeEngine;
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

/** Ranks recipes for a loop: shared stack items count for, a major mismatch against; ties keep store order. Zero-score recipes drop out. */
export function matchRecipes(recipes: readonly RecipeSummary[], deps: Readonly<Record<string, string>>): RecipeSummary[] {
  return recipes
    .map((recipe) => {
      const { matched, mismatched } = stackOverlap(recipe.stack, deps);
      const score = matched.length - mismatched.length;
      const parts = [`stack ${matched.length}/${recipe.stack.length}`];
      if (mismatched.length > 0) parts.push(`major differs: ${mismatched.join(', ')}`);
      return { ...recipe, match: { score, reason: parts.join(', ') } };
    })
    .filter((r) => r.match.score > 0)
    .sort((a, b) => b.match.score - a.match.score);
}

/** `*.md` recipe files of one folder, drafts (`*.draft.md`) excluded. Missing folder → none. */
export async function readRecipeStore(dir: string, store: 'project' | 'user', label: (file: string) => string): Promise<RecipeSummary[]> {
  const names = (await readdir(dir).catch(() => [])).filter((n) => n.endsWith('.md') && !n.endsWith('.draft.md')).sort();
  const recipes: RecipeSummary[] = [];
  for (const name of names) {
    const file = path.join(dir, name);
    const text = await readOptional(file);
    const recipe = text === undefined ? undefined : summarizeRecipe(text, store, label(file));
    if (recipe) recipes.push(recipe);
  }
  return recipes;
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

/** `GET /api/recipes`: project recipes of the given clones (paths relative to the clone), then the user's store; a duplicate id keeps the first. */
export async function readRecipes(loopDirs: readonly string[], userDir: string = userRecipeDir(), home?: string): Promise<RecipeSummary[]> {
  const found = [
    ...(await Promise.all(loopDirs.map((dir) => readRecipeStore(path.join(dir, '.ai', 'recipes'), 'project', (file) => path.relative(dir, file).split(path.sep).join('/'))))).flat(),
    ...(await readRecipeStore(userDir, 'user', userLabel(home))),
  ];
  return found.filter((r, i) => found.findIndex((o) => o.id === r.id) === i);
}

/** Triggers of `.ai/triggers.yaml` (method C.5); entries without an id or `on` are skipped. */
export function parseTriggers(text: string | undefined, fired: ReadonlyMap<string, number> = new Map()): TriggerInfo[] {
  if (text === undefined) return [];
  let data: unknown;
  try {
    data = parseYaml(text);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const triggers: TriggerInfo[] = [];
  for (const raw of data) {
    if (typeof raw !== 'object' || raw === null) continue;
    const { id, on, inject } = raw as Record<string, unknown>;
    if (typeof id !== 'string' || typeof on !== 'string') continue;
    const entry = typeof inject === 'string' ? /\bK-\d+\b/.exec(inject)?.[0] : undefined;
    triggers.push({ id, kinds: [on], fired: fired.get(id) ?? 0, ...(entry && { entry }) });
  }
  return triggers;
}

/** Fire counts per trigger id from `.ai/.trigger-log.jsonl` (`{at, session, id, event}` per line); bad lines are skipped. */
export function countFires(log: string | undefined): Map<string, number> {
  const counts = new Map<string, number>();
  for (const line of (log ?? '').split(/\r?\n/)) {
    try {
      const id = (JSON.parse(line) as { id?: unknown }).id;
      if (typeof id === 'string') counts.set(id, (counts.get(id) ?? 0) + 1);
    } catch {
      // blank or partial line
    }
  }
  return counts;
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
    const parsed = splitFrontMatter((await readOptional(path.join(knowledgeDir, name))) ?? '');
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

/** `GET /api/loops/:id/knowledge` for one clone; `recipes` is the already-read recipe list to match against its package.json. */
export async function readKnowledge(dir: string, recipes: readonly RecipeSummary[]): Promise<KnowledgeReport> {
  const fired = countFires(await readOptional(path.join(dir, '.ai', '.trigger-log.jsonl')));
  const triggers = parseTriggers(await readOptional(path.join(dir, '.ai', 'triggers.yaml')), fired);
  return {
    entries: await readKnowledgeEntries(dir, triggers),
    triggers,
    recipes: matchRecipes(recipes, dependencyMajors(await readOptional(path.join(dir, 'package.json')))),
  };
}

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length === 0 ? 0 : sorted.length % 2 === 1 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
};

/** One line of `evals/results/*.jsonl` → fields, or undefined when it is not a result. */
function parseResultLine(line: string): { task: string; arm: EvalRow['arm']; model: string; pass: boolean; tokens: number; seconds: number; turns: number } | undefined {
  try {
    const r = JSON.parse(line) as Record<string, unknown>;
    const arm = r.arm === 'cold' || r.arm === 'recipe' || r.arm === 'recipe+triggers' ? r.arm : undefined;
    if (typeof r.task !== 'string' || typeof r.model !== 'string' || arm === undefined || typeof r.pass !== 'boolean') return undefined;
    const tokens = count(r.inputTokens) + count(r.outputTokens) + count(r.cacheReadTokens) + count(r.cacheCreationTokens);
    return { task: r.task, arm, model: r.model, pass: r.pass, tokens: tokens || count(r.tokens), seconds: count(r.durationMs) / 1000 || count(r.seconds), turns: count(r.turns) };
  } catch {
    return undefined;
  }
}

/** Table rows from result lines: one per task × arm × model, medians over its runs. */
export function evalRows(lines: readonly string[]): EvalRow[] {
  const groups = new Map<string, NonNullable<ReturnType<typeof parseResultLine>>[]>();
  for (const line of lines) {
    const r = parseResultLine(line);
    if (r) groups.set(`${r.task}\u0000${r.arm}\u0000${r.model}`, [...(groups.get(`${r.task}\u0000${r.arm}\u0000${r.model}`) ?? []), r]);
  }
  return [...groups.values()]
    .map((g) => ({
      task: (g[0] as { task: string }).task,
      arm: (g[0] as { arm: EvalRow['arm'] }).arm,
      model: (g[0] as { model: string }).model,
      runs: g.length,
      passed: g.filter((r) => r.pass).length,
      medianTokens: Math.round(median(g.map((r) => r.tokens))),
      medianSeconds: Math.round(median(g.map((r) => r.seconds))),
      medianTurns: median(g.map((r) => r.turns)),
    }))
    .sort((a, b) => a.model.localeCompare(b.model) || a.task.localeCompare(b.task) || a.arm.localeCompare(b.arm));
}

/** One sentence per model from the rows alone, e.g. "haiku: 3/3 with a recipe vs 1/3 cold, 58% fewer tokens". Undefined without a cold and a recipe arm. */
export function evalHeadline(rows: readonly EvalRow[]): string | undefined {
  const sentences: string[] = [];
  for (const model of [...new Set(rows.map((r) => r.model))]) {
    const sum = (arm: string) => {
      const own = rows.filter((r) => r.model === model && (arm === 'recipe' ? r.arm !== 'cold' : r.arm === 'cold'));
      return { runs: own.reduce((n, r) => n + r.runs, 0), passed: own.reduce((n, r) => n + r.passed, 0), tokens: own.reduce((n, r) => n + r.medianTokens * r.runs, 0) };
    };
    const cold = sum('cold');
    const recipe = sum('recipe');
    if (cold.runs === 0 || recipe.runs === 0) continue;
    const saved = cold.tokens > 0 ? Math.round((1 - recipe.tokens / recipe.runs / (cold.tokens / cold.runs)) * 100) : 0;
    const tokens = saved > 0 ? `, ${saved}% fewer tokens` : '';
    sentences.push(`${model}: ${recipe.passed}/${recipe.runs} with a recipe vs ${cold.passed}/${cold.runs} cold${tokens}`);
  }
  return sentences.length > 0 ? sentences.join('; ') : undefined;
}

/** `GET /api/eval` for the given result folders: the newest `.jsonl` of each, merged. No results → empty rows and no headline. */
export async function readEval(resultDirs: readonly string[]): Promise<EvalReportData> {
  const lines: string[] = [];
  for (const dir of resultDirs) {
    const files = (await readdir(dir).catch(() => [])).filter((n) => n.endsWith('.jsonl')).sort();
    const newest = files.at(-1);
    if (newest) lines.push(...((await readOptional(path.join(dir, newest))) ?? '').split(/\r?\n/));
  }
  const rows = evalRows(lines);
  const headline = evalHeadline(rows);
  return { rows, ...(headline && { headline }), sample: false, command: EVAL_COMMAND };
}
