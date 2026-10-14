import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fakeRunner, formatEvalReport, loadTask, parseArms, parseEnvFile, readEvalReport, runEval, type EvalRunner } from '../../../src/cli/eval.js';

const execFileAsync = promisify(execFile);
const fixture = await readFile(new URL('../../fixtures/claude-result.json', import.meta.url), 'utf8');
const CHECK = "import { existsSync } from 'node:fs';\nprocess.exit(existsSync('done.txt') ? 0 : 1);\n";
const RECIPE = `---
id: R-demo
title: Demo
kind: project
stack: [node@20]
tags: []
status: CONFIRMED
source: o/r@abc1234
uses: 0
passes: 0
updated: 2026-10-14
---
# Demo recipe

## When to use
x

## Steps
1. Make done.txt. (proof: \`node check.mjs\`)

## Traps
- t

## Checks
- \`node check.mjs\`

## Start from
- a
`;

describe('loop eval', () => {
  let root: string;
  let evals: string;
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'loop-evalrun-'));
    process.env.LOOP_HOME = path.join(root, 'home');
    evals = path.join(root, 'evals');
    await mkdir(path.join(evals, 'demo', 'repo'), { recursive: true });
    await mkdir(path.join(evals, 'demo', 'solution'), { recursive: true });
    await writeFile(path.join(evals, 'demo', 'task.md'), 'Create done.txt.\n');
    await writeFile(path.join(evals, 'demo', 'repo', 'check.mjs'), CHECK);
    await writeFile(path.join(evals, 'demo', 'solution', 'done.txt'), 'ok');
    await writeFile(path.join(evals, 'demo', 'eval.json'), JSON.stringify({ check: 'node check.mjs', recipe: 'R-demo' }));
    await mkdir(path.join(root, '.ai', 'recipes'), { recursive: true });
    await writeFile(path.join(root, '.ai', 'recipes', 'R-demo.md'), RECIPE);
  });
  afterEach(() => rm(root, { recursive: true, force: true, maxRetries: 5 }));

  it('loads a task from eval.json or from plain check and recipe files', async () => {
    expect(await loadTask(evals, 'demo')).toMatchObject({ id: 'demo', prompt: 'Create done.txt.', check: ['node', 'check.mjs'], recipe: 'R-demo' });
    await rm(path.join(evals, 'demo', 'eval.json'));
    await writeFile(path.join(evals, 'demo', 'check'), 'node check.mjs\n');
    await writeFile(path.join(evals, 'demo', 'recipe'), 'R-demo\n');
    expect(await loadTask(evals, 'demo')).toMatchObject({ check: ['node', 'check.mjs'], recipe: 'R-demo' });
    await rm(path.join(evals, 'demo', 'check'));
    await expect(loadTask(evals, 'demo')).rejects.toThrow(/no check/);
    await expect(loadTask(evals, 'nope')).rejects.toThrow(/task.md is missing/);
  });

  it('the fake runner passes when it applies solution/ and fails when it does nothing', async () => {
    const solve = await runEval({ evalsDir: evals, arms: ['cold'], model: 'fake', runs: 1, runner: fakeRunner('solve') });
    const nothing = await runEval({ evalsDir: evals, arms: ['cold'], model: 'fake', runs: 1, runner: fakeRunner('nothing') });
    expect(solve.results[0]?.pass).toBe(true);
    expect(nothing.results[0]?.pass).toBe(false);
    expect(solve.savedTo).toBeUndefined();
    await expect(readdir(path.join(evals, 'results'))).rejects.toThrow();
  });

  it('works in a temp copy: the fixture is untouched, the copy is a git repo and is removed', async () => {
    let seen = '';
    const runner: EvalRunner = async ({ cwd }) => {
      seen = cwd;
      expect(execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd, encoding: 'utf8' }).trim()).toBe('true');
      await writeFile(path.join(cwd, 'done.txt'), 'x');
      return fixture;
    };
    const { results } = await runEval({ evalsDir: evals, arms: ['cold'], model: 'haiku', runs: 1, runner });
    expect(results[0]).toMatchObject({ pass: true, inputTokens: 1450, outputTokens: 5230, cacheReadTokens: 61000, durationMs: 41873, turns: 12 });
    expect(seen).not.toContain(evals);
    await expect(readdir(seen)).rejects.toThrow();
    await expect(readdir(path.join(evals, 'demo', 'repo'))).resolves.toEqual(['check.mjs']);
  });

  it('the recipe arm prepends the recipe context (no front matter); the cold arm does not', async () => {
    const prompts: Record<string, string> = {};
    const runner: EvalRunner = async ({ prompt, arm }) => {
      prompts[arm] = prompt;
      return fixture;
    };
    await runEval({ evalsDir: evals, arms: ['cold', 'recipe'], model: 'haiku', runs: 1, runner });
    expect(prompts.cold).toBe('Create done.txt.');
    expect(prompts.recipe?.startsWith('# Demo recipe')).toBe(true);
    expect(prompts.recipe).toContain('## Steps');
    expect(prompts.recipe).not.toContain('updated:');
    expect(prompts.recipe?.endsWith('Create done.txt.')).toBe(true);
  });

  it('recipe+triggers installs the task triggers and hooks in the copy, and says what is missing', async () => {
    await expect(runEval({ evalsDir: evals, arms: ['recipe+triggers'], model: 'm', runs: 1, runner: fakeRunner('nothing') })).rejects.toThrow(/triggers.yaml is missing/);
    await writeFile(path.join(evals, 'demo', 'triggers.yaml'), '- id: K-1\n  on: topic\n  match: x\n  inject: y\n');
    let settings = '';
    let triggers = '';
    const runner: EvalRunner = async ({ cwd }) => {
      settings = await readFile(path.join(cwd, '.claude', 'settings.json'), 'utf8');
      triggers = await readFile(path.join(cwd, '.ai', 'triggers.yaml'), 'utf8');
      return fixture;
    };
    await runEval({ evalsDir: evals, arms: ['recipe+triggers'], model: 'm', runs: 1, runner });
    expect(settings).toContain('hook PreToolUse');
    expect(triggers).toContain('K-1');
  });

  it('a missing recipe is a clear error', async () => {
    await rm(path.join(root, '.ai', 'recipes', 'R-demo.md'));
    await expect(runEval({ evalsDir: evals, arms: ['recipe'], model: 'm', runs: 1, runner: fakeRunner('solve') })).rejects.toThrow(/Recipe R-demo .* is not in/);
  });

  it('prints the exact command before each run and rejects bad --runs', async () => {
    const lines: string[] = [];
    await runEval({ evalsDir: evals, arms: ['cold'], model: 'haiku', runs: 2, runner: fakeRunner('solve'), log: (l) => lines.push(l) });
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('claude -p <prompt> --output-format json --max-turns 30');
    expect(lines[0]).toContain('--model haiku');
    await expect(runEval({ evalsDir: evals, arms: ['cold'], model: 'm', runs: 0, runner: fakeRunner('solve') })).rejects.toThrow(/--runs/);
    await expect(runEval({ evalsDir: path.join(root, 'none'), arms: ['cold'], model: 'm', runs: 1, runner: fakeRunner('solve') })).rejects.toThrow(/No eval tasks/);
  });

  it('saves results to evals/results/<date>-<model>.jsonl and the report builds a table and headline from them', async () => {
    expect(await readEvalReport(evals)).toEqual({ rows: [] });
    expect(formatEvalReport({ rows: [] })).toMatch(/No eval results yet.*loop eval run/);
    const save = { dir: root, date: '2026-10-14' };
    const cold: EvalRunner = async () => fixture;
    await runEval({ evalsDir: evals, arms: ['cold'], model: 'haiku', runs: 1, runner: cold, save });
    const mid = await readEvalReport(evals);
    expect(mid.headline).toBeUndefined();
    expect(formatEvalReport(mid)).toContain('No headline');
    const solving: EvalRunner = async ({ cwd }) => {
      await writeFile(path.join(cwd, 'done.txt'), 'x');
      return fixture.replace('61000', '1000');
    };
    const saved = await runEval({ evalsDir: evals, arms: ['recipe'], model: 'haiku', runs: 1, runner: solving, save });
    expect(saved.savedTo).toBe('evals/results/2026-10-14-haiku.jsonl');
    const report = await readEvalReport(evals);
    expect(report.rows.map((r) => [r.arm, r.passed])).toEqual([['cold', 0], ['recipe', 1]]);
    expect(report.headline).toMatch(/^haiku: 1\/1 with a recipe vs 0\/1 cold, \d+% fewer tokens$/);
    expect(formatEvalReport(report)).toContain(report.headline as string);
  });

  it('parses env files without keeping comments, and arms', () => {
    expect(parseEnvFile('# c\nANTHROPIC_BASE_URL=http://localhost:11434\nexport ANTHROPIC_AUTH_TOKEN="ollama"\nANTHROPIC_API_KEY=\nbad line\n')).toEqual({ ANTHROPIC_BASE_URL: 'http://localhost:11434', ANTHROPIC_AUTH_TOKEN: 'ollama', ANTHROPIC_API_KEY: '' });
    expect(parseArms('both')).toEqual(['cold', 'recipe']);
    expect(parseArms('all')).toHaveLength(3);
    expect(parseArms('recipe+triggers')).toEqual(['recipe+triggers']);
    expect(() => parseArms('warm')).toThrow(/--arm/);
  });

  it('passes the env file to the runner', async () => {
    await writeFile(path.join(root, 'env'), 'A=1\n');
    let env: Record<string, string> = {};
    await runEval({ evalsDir: evals, arms: ['cold'], model: 'm', runs: 1, envFile: path.join(root, 'env'), runner: async (i) => ((env = i.env), fixture) });
    expect(env).toEqual({ A: '1' });
    await expect(runEval({ evalsDir: evals, arms: ['cold'], model: 'm', runs: 1, envFile: path.join(root, 'nope'), runner: fakeRunner('solve') })).rejects.toThrow(/--env-file/);
  });

  it('the CLI: --runner fake passes, fails with --fake-mode nothing (exit 1), saves nothing, and report is empty', async () => {
    const loop = (...args: string[]) => execFileAsync(process.execPath, ['--import', 'tsx', path.resolve('src/cli/index.ts'), 'eval', ...args, '--dir', root], { env: process.env });
    const ok = JSON.parse((await loop('run', '--runner', 'fake', '--task', 'demo', '--arm', 'both', '--json')).stdout) as { results: { pass: boolean; model: string }[] };
    expect(ok.results.map((r) => [r.pass, r.model])).toEqual([[true, 'fake'], [true, 'fake']]);
    await expect(loop('run', '--runner', 'fake', '--fake-mode', 'nothing', '--task', 'demo')).rejects.toMatchObject({ code: 1 });
    expect(JSON.parse((await loop('report', '--json')).stdout)).toEqual({ rows: [] });
    await expect(loop('run', '--runner', 'bogus')).rejects.toMatchObject({ code: 1 });
  }, 90_000);
});
