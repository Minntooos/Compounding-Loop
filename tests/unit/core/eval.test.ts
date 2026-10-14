import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EVAL_TOOLS, buildEvalReport, evalClaudeArgs, evalHeadline, evalRows, formatEvalTable, formatResult, median, parseClaudeJson, parseResults, resultsFile, totalTokens, type EvalResult } from '../../../src/core/eval.js';

const fixture = readFileSync(new URL('../../fixtures/claude-result.json', import.meta.url), 'utf8');
const result = (over: Partial<EvalResult>): EvalResult => ({ at: '2026-10-14T00:00:00Z', task: 't', arm: 'cold', model: 'haiku', pass: true, inputTokens: 100, outputTokens: 100, cacheReadTokens: 0, cacheCreationTokens: 0, costUsd: 0, durationMs: 10_000, turns: 5, ...over });

describe('parseClaudeJson', () => {
  it('reads tokens, cost, time and turns from a recorded claude -p result', () => {
    expect(parseClaudeJson(fixture)).toEqual({ inputTokens: 1450, outputTokens: 5230, cacheReadTokens: 61000, cacheCreationTokens: 8200, costUsd: 0.0412, durationMs: 41873, turns: 12, isError: false });
  });
  it('takes the result item of a JSON array', () => {
    expect(parseClaudeJson(`[{"type":"system"},${fixture}]`).turns).toBe(12);
  });
  it('flags errors such as the turn limit and tolerates missing usage', () => {
    expect(parseClaudeJson('{"type":"result","subtype":"error_max_turns","num_turns":30}')).toMatchObject({ isError: true, turns: 30, inputTokens: 0 });
    expect(parseClaudeJson('{"type":"result","is_error":true}').isError).toBe(true);
  });
  it('explains output it cannot read', () => {
    expect(() => parseClaudeJson('Error: nope')).toThrow(/did not print JSON/);
    expect(() => parseClaudeJson('[1]')).toThrow(/without a result/);
    expect(() => parseClaudeJson('null')).toThrow(/without a result/);
  });
});

describe('claude arguments and file names', () => {
  it('limits turns and tools, passes the prompt as one entry and the model when given', () => {
    const args = evalClaudeArgs('do it; rm -rf /', 'haiku');
    expect(args.slice(0, 2)).toEqual(['-p', 'do it; rm -rf /']);
    expect(args).toContain('json');
    expect(args[args.indexOf('--max-turns') + 1]).toBe('30');
    expect(args[args.indexOf('--allowedTools') + 1]).toBe(EVAL_TOOLS.join(','));
    expect(args.slice(-2)).toEqual(['--model', 'haiku']);
    expect(evalClaudeArgs('x')).not.toContain('--model');
    expect(EVAL_TOOLS.some((t) => /^Bash\((?!node|npm)/.test(t))).toBe(false);
  });
  it('names the results file by date and a filename-safe model', () => {
    expect(resultsFile('2026-10-14', 'ollama/qwen3:8b')).toBe('evals/results/2026-10-14-ollama-qwen3-8b.jsonl');
  });
});

describe('results, rows and headline', () => {
  const results = [
    result({ arm: 'cold', pass: false, inputTokens: 1000, outputTokens: 1000 }),
    result({ arm: 'cold', pass: true, inputTokens: 1000, outputTokens: 1000 }),
    result({ arm: 'recipe', pass: true, inputTokens: 400, outputTokens: 400 }),
    result({ arm: 'recipe', pass: true, inputTokens: 400, outputTokens: 400, durationMs: 20_000, turns: 9 }),
  ];
  it('round-trips through the jsonl format and skips broken lines', () => {
    const text = `${results.map(formatResult).join('')}broken\n{"task":1}\n`;
    expect(parseResults(text)).toEqual(results);
  });
  it('one row per task × arm × model with medians', () => {
    const rows = evalRows(results);
    expect(rows).toEqual([
      { task: 't', arm: 'cold', model: 'haiku', runs: 2, passed: 1, medianTokens: 2000, medianSeconds: 10, medianTurns: 5 },
      { task: 't', arm: 'recipe', model: 'haiku', runs: 2, passed: 2, medianTokens: 800, medianSeconds: 15, medianTurns: 7 },
    ]);
  });
  it('builds the headline from the rows only', () => {
    expect(buildEvalReport(results).headline).toBe('haiku: 2/2 with a recipe vs 1/2 cold, 60% fewer tokens');
  });
  it('has no headline without both a cold and a recipe arm, and none without results', () => {
    expect(buildEvalReport(results.filter((r) => r.arm === 'cold')).headline).toBeUndefined();
    expect(buildEvalReport(results.filter((r) => r.arm === 'recipe')).headline).toBeUndefined();
    expect(buildEvalReport([])).toEqual({ rows: [] });
    expect(evalHeadline([])).toBeUndefined();
  });
  it('omits "fewer tokens" when the recipe arm used more', () => {
    expect(buildEvalReport([result({ arm: 'cold', inputTokens: 1 }), result({ arm: 'recipe', inputTokens: 5000 })]).headline).toBe('haiku: 1/1 with a recipe vs 1/1 cold');
  });
  it('one sentence per model', () => {
    const h = buildEvalReport([...results, result({ model: 'local', arm: 'cold' }), result({ model: 'local', arm: 'recipe+triggers' })]).headline;
    expect(h).toMatch(/^haiku: .*; local: 1\/1 with a recipe vs 1\/1 cold/);
  });
  it('prints a table', () => {
    const table = formatEvalTable(evalRows(results));
    expect(table.split('\n')[0]).toMatch(/^task\s+arm\s+model\s+pass\s+tokens\s+time\s+turns$/);
    expect(table).toContain('1/2');
  });
  it('median and totals', () => {
    expect([median([]), median([3]), median([1, 9, 3]), median([1, 2, 3, 4])]).toEqual([0, 3, 3, 2.5]);
    expect(totalTokens(result({ cacheReadTokens: 5, cacheCreationTokens: 7 }))).toBe(212);
  });
});
