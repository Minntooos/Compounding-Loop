import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir } from 'node:fs/promises';
import { briefBlocker, planInit, type InitAction, type KitFile } from '../core/init.js';
import { SETTINGS_FILE, STARTER_TRIGGERS, mergeHookSettings } from '../core/hooksInit.js';
import { TRIGGERS_FILE } from '../core/triggers.js';
import { dependencyMajors, matchRecipes, parseRecipe } from '../core/recipes.js';

/** Root of the installed package (or this checkout): two levels above `dist/cli` or `src/cli`. */
export const packageRoot = fileURLToPath(new URL('../../', import.meta.url));

const FALLBACK_INDEX = '# Knowledge index\n\nOne line per entry in `.ai/knowledge/`: `K-0001 · trigger (error text, file path or topic) · one-line lesson`.\n\n<!-- empty: the loop adds entries as it learns -->\n';
const FALLBACK_LOG = '# Log\n\nOne line per finished task: `date · task · runs used · repeat errors · result`.\n';
const FALLBACK_TASK = '# TASK: Build v1 of IDEA.md\n\nRun: 0 / 30\n\n## Contract\n- Goal:\n- Done when:\n- Constraints:\n- Out of scope:\n\n## Handoff\n(each run ends by writing: where it stopped, the exact next step, anything half-done)\n';

async function readIfExists(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, 'utf8');
  } catch {
    return undefined;
  }
}

export interface Kit {
  files: KitFile[];
  card: string | undefined;
  /** Kit files that were not found, so the user (and the kit lane) can see what is missing. */
  missing: string[];
}

/** Loads the method files `loop init` installs from the package's `method/` folder. */
export async function loadKit(root: string = packageRoot): Promise<Kit> {
  const missing: string[] = [];
  const read = async (rel: string, fallback?: string) => {
    const text = await readIfExists(path.join(root, rel));
    if (text === undefined) missing.push(rel);
    return text ?? fallback;
  };
  const card = await read('method/operating-card.md');
  const method = await read('method/COMPOUNDING_LOOP.md');
  const task = await read('method/task-template.md', FALLBACK_TASK);
  const index = await read('method/knowledge-index.md', FALLBACK_INDEX);
  const files: KitFile[] = [
    { dest: '.ai/index.md', content: index ?? FALLBACK_INDEX, keep: true },
    { dest: '.ai/log.md', content: FALLBACK_LOG, keep: true },
    { dest: '.ai/task.md', content: task ?? FALLBACK_TASK, keep: true },
    { dest: '.ai/knowledge/.gitkeep', content: '', keep: true },
    { dest: '.ai/plans/.gitkeep', content: '', keep: true },
    { dest: TRIGGERS_FILE, content: (await readIfExists(path.join(root, 'templates', 'triggers.yaml'))) ?? STARTER_TRIGGERS, keep: true },
  ];
  if (method !== undefined) files.push({ dest: '.ai/method.md', content: method });
  return { files, card, missing };
}

export interface InitResult {
  actions: InitAction[];
  missing: string[];
  /** Set when the brief blocked the run; nothing was written. */
  refused?: string;
  /** Seed recipes from the package that `loop recipe match` ranks above zero for this repo and that are not installed yet. */
  recipeOffers: RecipeOffer[];
  /** With `--hooks`: events that got a hook in `.claude/settings.json`. */
  hooksAdded?: string[];
}

export interface RecipeOffer {
  id: string;
  title: string;
  reason: string;
  /** Path inside the package, for `loop recipe add`. */
  file: string;
  /** The file's text, so `--recipes` can install it. */
  content: string;
}

/** Seed recipes shipped in `templates/recipes/` that fit the target repo's stack and are not already in `.ai/recipes/`. */
export async function offerRecipes(target: string, root: string = packageRoot): Promise<RecipeOffer[]> {
  const dir = path.join(root, 'templates', 'recipes');
  const seeds: { recipe: NonNullable<ReturnType<typeof parseRecipe>>; file: string; content: string }[] = [];
  for (const name of (await readdir(dir).catch(() => [] as string[])).filter((n) => n.endsWith('.md')).sort()) {
    const content = await readIfExists(path.join(dir, name));
    const recipe = content === undefined ? undefined : parseRecipe(content);
    if (content !== undefined && recipe) seeds.push({ recipe, file: path.join('templates', 'recipes', name), content });
  }
  const deps = dependencyMajors(await readIfExists(path.join(target, 'package.json')));
  const installed = new Set((await readdir(path.join(target, '.ai', 'recipes')).catch(() => [] as string[])).map((n) => n.replace(/\.md$/, '')));
  return matchRecipes(seeds.map((s) => s.recipe), deps)
    .filter((m) => !installed.has(m.recipe.id))
    .map((m) => {
      const seed = seeds.find((s) => s.recipe === m.recipe)!;
      return { id: m.recipe.id, title: m.recipe.title, reason: m.reason, file: seed.file, content: seed.content };
    });
}

export async function runInit(target: string, options: { force: boolean; dryRun: boolean; /** Laned loops keep their tasks per lane, so skip the single `.ai/task.md`. */ skipTask?: boolean; /** Also merge the five `loop hook` commands into `.claude/settings.json`. */ hooks?: boolean; /** Install the offered seed recipes into `.ai/recipes/`. */ recipes?: boolean }, kit?: Kit, root: string = packageRoot): Promise<InitResult> {
  const loadedKit = kit ?? (await loadKit());
  const loaded = options.skipTask ? { ...loadedKit, files: loadedKit.files.filter((f) => f.dest !== '.ai/task.md') } : loadedKit;
  const brief = await readIfExists(path.join(target, 'IDEA.md'));
  const blocker = options.force ? undefined : briefBlocker(brief);
  if (blocker) return { actions: [], missing: loaded.missing, refused: blocker, recipeOffers: [] };

  const existing = new Map<string, string>();
  for (const dest of [...loaded.files.map((f) => f.dest), 'CLAUDE.md', 'AGENTS.md']) {
    const text = await readIfExists(path.join(target, ...dest.split('/')));
    if (text !== undefined) existing.set(dest, text);
  }
  let actions: InitAction[];
  try {
    actions = planInit({ kit: loaded.files, card: loaded.card, existing, force: options.force });
  } catch (error) {
    return { actions: [], missing: loaded.missing, refused: error instanceof Error ? error.message : String(error), recipeOffers: [] };
  }
  let hooksAdded: string[] | undefined;
  if (options.hooks) {
    const current = await readIfExists(path.join(target, ...SETTINGS_FILE.split('/')));
    const merged = mergeHookSettings(current);
    if (merged.error || merged.content === undefined) return { actions: [], missing: loaded.missing, refused: merged.error ?? 'Could not merge hooks.', recipeOffers: [] };
    hooksAdded = merged.added;
    actions.push(merged.added.length === 0 ? { dest: SETTINGS_FILE, kind: 'skip', reason: 'hooks already installed' } : { dest: SETTINGS_FILE, kind: current === undefined ? 'create' : 'update', content: merged.content });
  }
  const recipeOffers = await offerRecipes(target, root);
  if (options.recipes) for (const offer of recipeOffers) actions.push({ dest: `.ai/recipes/${offer.id}.md`, kind: 'create', content: offer.content });
  if (!options.dryRun) {
    for (const action of actions) {
      if (action.content === undefined) continue;
      const file = path.join(target, ...action.dest.split('/'));
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, action.content);
    }
  }
  return { actions, missing: loaded.missing, recipeOffers: options.recipes ? [] : recipeOffers, ...(hooksAdded && { hooksAdded }) };
}
