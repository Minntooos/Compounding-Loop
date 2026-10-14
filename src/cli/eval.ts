import { execFile } from 'node:child_process';
import { appendFile, cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { EVAL_ARMS, buildEvalReport, evalClaudeArgs, formatEvalTable, formatResult, parseClaudeJson, parseResults, resultsFile, type ClaudeRunStats, type EvalArm, type EvalReport, type EvalResult } from '../core/eval.js';
import { mergeHookSettings } from '../core/hooksInit.js';
import { recipeContext } from '../core/recipes.js';
import { findRecipe } from './recipe.js';
import { packageRoot } from './init.js';
import { resolveInvocation } from './run.js';

const execFileAsync = promisify(execFile);

export interface EvalTask {
  id: string;
  /** Absolute folder `evals/<id>`. */
  dir: string;
  /** The one-paragraph request a cold model gets. */
  prompt: string;
  /** The check as an argument array: never a shell string. */
  check: string[];
  /** Recipe id for the recipe arm, when the task names one. */
  recipe?: string;
  /** Recipe text from `recipeFile` (a path inside the task folder) for a recipe that is not a shipped seed. */
  recipeText?: string;
}

const readText = (file: string) => readFile(file, 'utf8').catch(() => undefined);
const splitCommand = (line: string): string[] => line.trim().split(/\s+/).filter(Boolean);

/** Loads `evals/<id>/`: `task.md`, `repo/`, and the check and recipe id from `eval.json` (`{"check": "node --test" | ["node","--test"], "recipe": "R-…"}`) or the plain files `check` and `recipe`. */
export async function loadTask(evalsDir: string, id: string): Promise<EvalTask> {
  const dir = path.join(evalsDir, id);
  const prompt = (await readText(path.join(dir, 'task.md')))?.trim();
  if (!prompt) throw new Error(`evals/${id}/task.md is missing or empty.`);
  if (!(await stat(path.join(dir, 'repo')).then((s) => s.isDirectory(), () => false))) throw new Error(`evals/${id}/repo/ is missing.`);
  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse((await readText(path.join(dir, 'eval.json'))) ?? '{}') as Record<string, unknown>;
  } catch {
    throw new Error(`evals/${id}/eval.json is not valid JSON.`);
  }
  const rawCheck = meta.check ?? (await readText(path.join(dir, 'check')));
  const check = Array.isArray(rawCheck) ? rawCheck.filter((c): c is string => typeof c === 'string') : typeof rawCheck === 'string' ? splitCommand(rawCheck) : [];
  if (check.length === 0) throw new Error(`evals/${id} has no check: put "check" in eval.json or write the command in evals/${id}/check.`);
  const recipe = typeof meta.recipe === 'string' ? meta.recipe : (await readText(path.join(dir, 'recipe')))?.trim();
  let recipeText: string | undefined;
  if (typeof meta.recipeFile === 'string') {
    const file = path.resolve(dir, meta.recipeFile);
    const rel = path.relative(dir, file);
    if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`evals/${id}/eval.json: recipeFile must stay inside the task folder.`);
    recipeText = await readText(file);
    if (recipeText === undefined) throw new Error(`evals/${id}/eval.json: recipeFile ${meta.recipeFile} is missing.`);
  }
  return { id, dir, prompt, check, ...(recipe && { recipe }), ...(recipeText !== undefined && { recipeText }) };
}

export async function listTaskIds(evalsDir: string): Promise<string[]> {
  const entries = await readdir(evalsDir, { withFileTypes: true }).catch(() => []);
  return entries.filter((e) => e.isDirectory() && e.name !== 'results').map((e) => e.name).sort();
}

/** `KEY=value` lines (comments and `export ` allowed, matching quotes stripped). Values are never printed. */
export function parseEnvFile(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(raw);
    if (!m || raw.trimStart().startsWith('#')) continue;
    env[m[1] as string] = (m[2] as string).replace(/^(["'])(.*)\1$/, '$2');
  }
  return env;
}

/** Runs one agent in `cwd` and returns what `claude -p --output-format json` printed. Injectable: tests use the fake. */
export type EvalRunner = (input: { prompt: string; cwd: string; model: string; task: EvalTask; arm: EvalArm; env: Record<string, string> }) => Promise<string>;

const realClaudeRunner: EvalRunner = async ({ prompt, cwd, model, env }) => {
  const { command, args } = await resolveInvocation('claude', evalClaudeArgs(prompt, model === 'default' ? undefined : model));
  const { stdout } = await execFileAsync(command, args, { cwd, env: { ...process.env, ...env }, maxBuffer: 64 * 1024 * 1024, timeout: 20 * 60_000 }).catch((error: Error & { stdout?: string }) => {
    // A non-zero exit still prints the JSON result for turn limits and errors.
    if (error.stdout?.trim().startsWith('{') || error.stdout?.trim().startsWith('[')) return { stdout: error.stdout };
    throw new Error(`Could not run \`claude -p\`: ${error.message}. Is Claude Code installed, on your PATH and signed in?`);
  });
  return stdout;
};

/** A stand-in for Claude: `solve` copies the task's `solution/` over the fixture, `nothing` changes nothing. It prints a result in the same JSON shape, with zero tokens. */
export const fakeRunner = (mode: 'solve' | 'nothing'): EvalRunner => async ({ cwd, task }) => {
  if (mode === 'solve') await cp(path.join(task.dir, 'solution'), cwd, { recursive: true, force: true });
  return JSON.stringify({ type: 'result', subtype: 'success', is_error: false, duration_ms: 1, num_turns: 1, total_cost_usd: 0, usage: { input_tokens: 0, output_tokens: 0 } });
};

export interface EvalRunOptions {
  evalsDir: string;
  /** Task ids; default: every folder in `evals/`. */
  tasks?: string[];
  /** Which arms to run. */
  arms: EvalArm[];
  model: string;
  runs: number;
  runner: EvalRunner;
  envFile?: string;
  /** Called with the exact command before each run. */
  log?: (line: string) => void;
  /** Where results are appended; undefined = print only (the fake runner never writes the real results). */
  save?: { dir: string; date: string };
  now?: () => Date;
}

/** Expands `both` (cold + recipe) and `all`. */
export function parseArms(value: string): EvalArm[] {
  if (value === 'both') return ['cold', 'recipe'];
  if (value === 'all') return [...EVAL_ARMS];
  if ((EVAL_ARMS as readonly string[]).includes(value)) return [value as EvalArm];
  throw new Error(`--arm must be cold, recipe, recipe+triggers, both or all, not "${value}".`);
}

/** The recipe's context: the user's or project's store first, then the seeds shipped in the package. */
async function recipeFor(task: EvalTask, repoDir: string): Promise<string> {
  if (task.recipeText !== undefined) return recipeContext(task.recipeText);
  if (!task.recipe) throw new Error(`evals/${task.id} names no recipe, so the recipe arm cannot run.`);
  const stored = await findRecipe(repoDir, task.recipe).then((s) => s.text, () => undefined);
  const seed = stored ?? (await readdir(path.join(packageRoot, 'templates', 'recipes')).catch(() => [] as string[]).then(async (names) => {
    for (const n of names) {
      const text = await readText(path.join(packageRoot, 'templates', 'recipes', n));
      if (text && new RegExp(`^id:\\s*${task.recipe}\\s*$`, 'm').test(text)) return text;
    }
    return undefined;
  }));
  if (!seed) throw new Error(`Recipe ${task.recipe} (named by evals/${task.id}) is not in .ai/recipes/, ~/.ai/recipes/ or the package seeds.`);
  return recipeContext(seed);
}

/** For the recipe+triggers arm: the task's `triggers.yaml` (and `knowledge/`) and the hooks, in the temp copy. */
async function installTriggers(task: EvalTask, cwd: string): Promise<void> {
  const triggers = await readText(path.join(task.dir, 'triggers.yaml'));
  if (triggers === undefined) throw new Error(`evals/${task.id}/triggers.yaml is missing, so the recipe+triggers arm cannot run.`);
  await mkdir(path.join(cwd, '.ai'), { recursive: true });
  await writeFile(path.join(cwd, '.ai', 'triggers.yaml'), triggers);
  await cp(path.join(task.dir, 'knowledge'), path.join(cwd, '.ai', 'knowledge'), { recursive: true }).catch(() => undefined);
  const merged = mergeHookSettings(undefined, `node ${path.join(packageRoot, 'bin', 'loop.js')} hook`);
  await mkdir(path.join(cwd, '.claude'), { recursive: true });
  await writeFile(path.join(cwd, '.claude', 'settings.json'), merged.content ?? '{}');
}

export interface EvalRunReport {
  results: EvalResult[];
  /** Repo-relative file the results were appended to, when saved. */
  savedTo?: string;
}

/** `loop eval run`: each run gets a fresh temp copy of the task's `repo/`, never the user's repo. */
export async function runEval(options: EvalRunOptions): Promise<EvalRunReport> {
  const env = options.envFile ? parseEnvFile((await readText(options.envFile)) ?? (() => { throw new Error(`Cannot read --env-file ${options.envFile}.`); })()) : {};
  const ids = options.tasks?.length ? options.tasks : await listTaskIds(options.evalsDir);
  if (ids.length === 0) throw new Error(`No eval tasks in ${options.evalsDir}. Each task is a folder with task.md, repo/ and a check.`);
  if (!Number.isInteger(options.runs) || options.runs < 1) throw new Error('--runs must be a whole number, 1 or more.');
  const results: EvalResult[] = [];
  for (const id of ids) {
    const task = await loadTask(options.evalsDir, id);
    for (const arm of options.arms) {
      for (let n = 1; n <= options.runs; n++) {
        const cwd = await mkdtemp(path.join(tmpdir(), `loop-eval-${id}-`));
        try {
          await cp(path.join(task.dir, 'repo'), cwd, { recursive: true });
          await execFileAsync('git', ['init', '-q'], { cwd });
          if (arm === 'recipe+triggers') await installTriggers(task, cwd);
          const context = arm === 'cold' ? '' : `${await recipeFor(task, path.dirname(options.evalsDir))}\n---\n\n`;
          const prompt = `${context}${task.prompt}`;
          const shown = evalClaudeArgs('<prompt>', options.model === 'default' ? undefined : options.model);
          options.log?.(`${id} · ${arm} · run ${n}/${options.runs}: claude ${shown.join(' ')}  (in a temp copy of evals/${id}/repo)`);
          const started = Date.now();
          const stdout = await options.runner({ prompt, cwd, model: options.model, task, arm, env });
          const stats: ClaudeRunStats = parseClaudeJson(stdout);
          // The check lives outside repo/ so the agent cannot read or edit it; it joins the copy only after the run.
          await cp(path.join(task.dir, 'verify'), path.join(cwd, 'verify'), { recursive: true }).catch(() => undefined);
          const [bin, ...args] = task.check;
          const pass = await execFileAsync(bin as string, args, { cwd, timeout: 120_000, env: process.env }).then(() => true, () => false);
          results.push({
            at: (options.now?.() ?? new Date()).toISOString(), task: id, arm, model: options.model, pass,
            inputTokens: stats.inputTokens, outputTokens: stats.outputTokens, cacheReadTokens: stats.cacheReadTokens, cacheCreationTokens: stats.cacheCreationTokens,
            costUsd: stats.costUsd, durationMs: stats.durationMs || Date.now() - started, turns: stats.turns,
          });
        } finally {
          await rm(cwd, { recursive: true, force: true, maxRetries: 5 });
        }
      }
    }
  }
  if (!options.save) return { results };
  const rel = resultsFile(options.save.date, options.model);
  const file = path.join(options.save.dir, ...rel.split('/'));
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, results.map(formatResult).join(''));
  return { results, savedTo: rel };
}

/** `loop eval report`: every `evals/results/*.jsonl`. No results, no rows, no headline. */
export async function readEvalReport(evalsDir: string): Promise<EvalReport> {
  const dir = path.join(evalsDir, 'results');
  const files = (await readdir(dir).catch(() => [] as string[])).filter((n) => n.endsWith('.jsonl')).sort();
  const results: EvalResult[] = [];
  for (const f of files) results.push(...parseResults((await readText(path.join(dir, f))) ?? ''));
  return buildEvalReport(results);
}

export function formatEvalReport(report: EvalReport): string {
  if (report.rows.length === 0) return 'No eval results yet. Run: loop eval run --task calc-page --arm both --model haiku';
  return `${formatEvalTable(report.rows)}\n\n${report.headline ?? 'No headline: it needs a cold and a recipe arm on the same model.'}`;
}

export const realRunner = realClaudeRunner;
