import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addRecipe, checkRecipes, formatMatches, formatRecipeList, listRecipes, loopHome, matchHere, showRecipe } from '../../../src/cli/recipe.js';

const run = promisify(execFile);
const GOOD = (id: string, extra = ''): string => `---
id: ${id}
title: ${id} title
kind: project
stack: [node@20, vite@5]
tags: [calculator]
status: CONFIRMED
source: owner/repo@abc1234
uses: 0
passes: 0
updated: 2026-10-14
---
# ${id}

## When to use
A thing.

## Steps
1. Do it. (proof: \`npm test\`)

## Traps
- A trap.

## Checks
- \`npm test\`

## Start from
- templates/x
${extra}`;

describe('loop recipe', () => {
  let dir: string;
  let home: string;
  const saved = process.env.LOOP_HOME;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'loop-recipe-'));
    home = await mkdtemp(path.join(tmpdir(), 'loop-home-'));
    process.env.LOOP_HOME = home;
    await mkdir(path.join(dir, '.ai', 'recipes'), { recursive: true });
    await mkdir(path.join(home, 'recipes'), { recursive: true });
    await writeFile(path.join(dir, 'package.json'), JSON.stringify({ engines: { node: '>=20' }, devDependencies: { vite: '^5.4.0' } }));
    await writeFile(path.join(dir, '.ai', 'recipes', 'R-one.md'), GOOD('R-one'));
    await writeFile(path.join(dir, '.ai', 'recipes', 'R-two.draft.md'), GOOD('R-two'));
    await writeFile(path.join(home, 'recipes', 'R-user.md'), GOOD('R-user').replace('[node@20, vite@5]', '[node@18]'));
    await writeFile(path.join(home, 'recipes', 'junk.md'), 'not a recipe');
  });
  afterEach(async () => {
    if (saved === undefined) delete process.env.LOOP_HOME;
    else process.env.LOOP_HOME = saved;
    await rm(dir, { recursive: true, force: true, maxRetries: 5 });
    await rm(home, { recursive: true, force: true, maxRetries: 5 });
  });

  it('loopHome prefers LOOP_HOME', () => {
    expect(loopHome({ LOOP_HOME: '/x' })).toBe('/x');
    expect(loopHome({})).toMatch(/\.ai$/);
  });

  it('list reads both stores, skips drafts and junk, and shows ~ paths', async () => {
    const list = await listRecipes(dir);
    expect(list.map((r) => [r.id, r.store, r.path])).toEqual([['R-one', 'project', '.ai/recipes/R-one.md'], ['R-user', 'user', '~/.ai/recipes/R-user.md']]);
    expect(list[0]).toMatchObject({ steps: 1, checks: 1 });
    expect(formatRecipeList(list)).toContain('R-one');
    expect(formatRecipeList([])).toMatch(/No recipes yet/);
  });

  it('show prints the file, --context drops the front matter, and accepts the id without R-', async () => {
    expect(await showRecipe(dir, 'R-one', false)).toContain('id: R-one');
    const ctx = await showRecipe(dir, 'one', true);
    expect(ctx.startsWith('# R-one')).toBe(true);
    expect(ctx).not.toContain('updated:');
    await expect(showRecipe(dir, 'R-nope', true)).rejects.toThrow(/No recipe "R-nope"/);
  });

  it('match ranks by stack, reads package.json majors and the task text', async () => {
    const m = await matchHere(dir);
    expect(m).toEqual([{ id: 'R-one', title: 'R-one title', score: 2, reason: 'stack 2/2', store: 'project', path: '.ai/recipes/R-one.md' }]);
    const withTask = await matchHere(dir, 'a calculator page');
    expect(withTask[0]?.reason).toBe('stack 2/2, tags: calculator');
    expect(formatMatches(m)).toContain('score 2');
    expect(formatMatches([])).toMatch(/No recipe matches/);
    expect(await matchHere(dir, '', 0)).toEqual([]);
  });

  it('check lints one file or the whole project store', async () => {
    expect(await checkRecipes(dir, '.ai/recipes/R-one.md')).toEqual([{ file: '.ai/recipes/R-one.md', problems: [] }]);
    await writeFile(path.join(dir, 'bad.md'), 'nope');
    expect((await checkRecipes(dir, 'bad.md'))[0]?.problems[0]).toMatch(/front matter/);
    expect((await checkRecipes(dir)).map((r) => r.file)).toEqual(['.ai/recipes/R-one.md', '.ai/recipes/R-two.draft.md']);
    await expect(checkRecipes(dir, 'missing.md')).rejects.toThrow(/Cannot read/);
  });

  it('add copies a valid recipe into the project or user store and refuses an invalid one', async () => {
    await writeFile(path.join(dir, 'new.md'), GOOD('R-new'));
    expect(await addRecipe(dir, 'new.md')).toEqual({ id: 'R-new', path: '.ai/recipes/R-new.md' });
    expect(await readFile(path.join(dir, '.ai', 'recipes', 'R-new.md'), 'utf8')).toContain('R-new');
    expect(await addRecipe(dir, 'new.md', true)).toEqual({ id: 'R-new', path: '~/.ai/recipes/R-new.md' });
    expect(await readFile(path.join(home, 'recipes', 'R-new.md'), 'utf8')).toContain('R-new');
    await writeFile(path.join(dir, 'bad.md'), GOOD('R-bad', '- /home/me/x\n'));
    await expect(addRecipe(dir, 'bad.md')).rejects.toThrow(/absolute path/);
    await expect(addRecipe(dir, 'gone.md')).rejects.toThrow(/Cannot read/);
  });

  it('every action works through the CLI with --json and check exits 1 on a bad recipe', async () => {
    const loop = (...args: string[]) => run('npx', ['tsx', path.resolve('src/cli/index.ts'), 'recipe', ...args, '--dir', dir], { env: { ...process.env, LOOP_HOME: home }, shell: process.platform === 'win32' });
    expect(JSON.parse((await loop('list', '--json')).stdout)).toHaveLength(2);
    expect(JSON.parse((await loop('show', 'R-one', '--context', '--json')).stdout).context).toContain('## Steps');
    expect(JSON.parse((await loop('match', 'calculator', '--json')).stdout)[0].id).toBe('R-one');
    expect(JSON.parse((await loop('check', '.ai/recipes/R-one.md', '--json')).stdout)[0].problems).toEqual([]);
    await writeFile(path.join(dir, 'bad.md'), 'nope');
    await expect(loop('check', 'bad.md')).rejects.toMatchObject({ code: 1 });
    expect(JSON.parse((await loop('add', '.ai/recipes/R-one.md', '--global', '--json')).stdout).id).toBe('R-one');
  }, 60_000);
});
