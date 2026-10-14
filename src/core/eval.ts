// The eval (IDEA.md Round 6 C): parse `claude -p --output-format json`, aggregate results, build the report. Pure and browser-safe.
import type { EvalRow } from './types.js';

export type EvalArm = EvalRow['arm'];
export const EVAL_ARMS: readonly EvalArm[] = ['cold', 'recipe', 'recipe+triggers'];
export const MAX_TURNS = 30;
/** Edits and `node`/`npm test` only, inside the temp copy. */
export const EVAL_TOOLS = ['Read', 'Edit', 'Write', 'Glob', 'Grep', 'Bash(node:*)', 'Bash(npm test:*)', 'Bash(npm run:*)'];

/** One line of `evals/results/*.jsonl`. */
export interface EvalResult {
  at: string;
  task: string;
  arm: EvalArm;
  model: string;
  pass: boolean;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUsd: number;
  durationMs: number;
  turns: number;
}

/** What `claude -p --output-format json` tells us about one run. */
export interface ClaudeRunStats {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUsd: number;
  durationMs: number;
  turns: number;
  isError: boolean;
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);

/** Reads the result object (a single JSON object, or the last `type: "result"` item of a JSON array). Throws with the reason when it is neither. */
export function parseClaudeJson(stdout: string): ClaudeRunStats {
  let raw: unknown;
  try {
    raw = JSON.parse(stdout);
  } catch {
    throw new Error('claude did not print JSON. Is it a recent Claude Code run with --output-format json?');
  }
  const item = Array.isArray(raw) ? [...raw].reverse().find((x) => x && typeof x === 'object' && (x as Record<string, unknown>).type === 'result') : raw;
  if (!item || typeof item !== 'object') throw new Error('claude printed JSON without a result object.');
  const r = item as Record<string, unknown>;
  const usage = (r.usage && typeof r.usage === 'object' ? r.usage : {}) as Record<string, unknown>;
  return {
    inputTokens: num(usage.input_tokens),
    outputTokens: num(usage.output_tokens),
    cacheReadTokens: num(usage.cache_read_input_tokens),
    cacheCreationTokens: num(usage.cache_creation_input_tokens),
    costUsd: num(r.total_cost_usd ?? r.cost_usd),
    durationMs: num(r.duration_ms),
    turns: num(r.num_turns),
    isError: r.is_error === true || (typeof r.subtype === 'string' && r.subtype.startsWith('error')),
  };
}

/** `claude -p` arguments for one run: JSON output, a turn cap and the restricted tool list. The prompt is one argv entry. */
export function evalClaudeArgs(prompt: string, model?: string): string[] {
  return ['-p', prompt, '--output-format', 'json', '--max-turns', String(MAX_TURNS), '--allowedTools', EVAL_TOOLS.join(','), ...(model ? ['--model', model] : [])];
}

/** `evals/results/<YYYY-MM-DD>-<model>.jsonl`; the model is made filename-safe. */
export const resultsFile = (date: string, model: string): string => `evals/results/${date}-${model.replace(/[^A-Za-z0-9._-]+/g, '-')}.jsonl`;

export const formatResult = (r: EvalResult): string => `${JSON.stringify(r)}\n`;

const isArm = (v: unknown): v is EvalArm => (EVAL_ARMS as readonly unknown[]).includes(v);

export function parseResults(text: string): EvalResult[] {
  const out: EvalResult[] = [];
  for (const line of text.split(/\r?\n/)) {
    try {
      const r = JSON.parse(line) as Record<string, unknown>;
      if (typeof r.task !== 'string' || typeof r.model !== 'string' || !isArm(r.arm) || typeof r.pass !== 'boolean') continue;
      out.push({
        at: typeof r.at === 'string' ? r.at : '', task: r.task, arm: r.arm, model: r.model, pass: r.pass,
        inputTokens: num(r.inputTokens), outputTokens: num(r.outputTokens), cacheReadTokens: num(r.cacheReadTokens), cacheCreationTokens: num(r.cacheCreationTokens),
        costUsd: num(r.costUsd), durationMs: num(r.durationMs), turns: num(r.turns),
      });
    } catch {
      // skip a broken line
    }
  }
  return out;
}

export const totalTokens = (r: EvalResult): number => r.inputTokens + r.outputTokens + r.cacheReadTokens + r.cacheCreationTokens;

export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return 0;
  return sorted.length % 2 === 1 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/** One row per task × arm × model with medians over its runs, sorted by model, task, arm. */
export function evalRows(results: readonly EvalResult[]): EvalRow[] {
  const groups = new Map<string, EvalResult[]>();
  for (const r of results) {
    const key = `${r.task}\u0000${r.arm}\u0000${r.model}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups.values()]
    .map((g): EvalRow => ({
      task: (g[0] as EvalResult).task,
      arm: (g[0] as EvalResult).arm,
      model: (g[0] as EvalResult).model,
      runs: g.length,
      passed: g.filter((r) => r.pass).length,
      medianTokens: Math.round(median(g.map(totalTokens))),
      medianSeconds: Math.round(median(g.map((r) => r.durationMs / 1000))),
      medianTurns: median(g.map((r) => r.turns)),
    }))
    .sort((a, b) => a.model.localeCompare(b.model) || a.task.localeCompare(b.task) || a.arm.localeCompare(b.arm));
}

/**
 * One sentence per model, built from the rows alone: "haiku: 3/3 with a recipe vs 1/3 cold, 58% fewer tokens".
 * Needs a cold and a recipe arm for the model; otherwise there is no headline (a number is never invented).
 */
export function evalHeadline(rows: readonly EvalRow[]): string | undefined {
  const sentences: string[] = [];
  for (const model of [...new Set(rows.map((r) => r.model))]) {
    const sum = (recipe: boolean) => {
      const own = rows.filter((r) => r.model === model && (recipe ? r.arm !== 'cold' : r.arm === 'cold'));
      return { runs: own.reduce((n, r) => n + r.runs, 0), passed: own.reduce((n, r) => n + r.passed, 0), tokens: own.reduce((n, r) => n + r.medianTokens * r.runs, 0) };
    };
    const cold = sum(false);
    const recipe = sum(true);
    if (cold.runs === 0 || recipe.runs === 0) continue;
    const saved = cold.tokens > 0 ? Math.round((1 - recipe.tokens / recipe.runs / (cold.tokens / cold.runs)) * 100) : 0;
    sentences.push(`${model}: ${recipe.passed}/${recipe.runs} with a recipe vs ${cold.passed}/${cold.runs} cold${saved > 0 ? `, ${saved}% fewer tokens` : ''}`);
  }
  return sentences.length > 0 ? sentences.join('; ') : undefined;
}

export interface EvalReport {
  rows: EvalRow[];
  /** Absent without a cold and a recipe arm to compare. */
  headline?: string;
}

export function buildEvalReport(results: readonly EvalResult[]): EvalReport {
  const rows = evalRows(results);
  const headline = evalHeadline(rows);
  return { rows, ...(headline && { headline }) };
}

/** A plain-text table of the rows. */
export function formatEvalTable(rows: readonly EvalRow[]): string {
  const head = ['task', 'arm', 'model', 'pass', 'tokens', 'time', 'turns'];
  const body = rows.map((r) => [r.task, r.arm, r.model, `${r.passed}/${r.runs}`, String(r.medianTokens), `${r.medianSeconds}s`, String(r.medianTurns)]);
  const widths = head.map((h, i) => Math.max(h.length, ...body.map((row) => (row[i] as string).length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i] as number)).join('  ').trimEnd();
  return [line(head), ...body.map(line)].join('\n');
}
