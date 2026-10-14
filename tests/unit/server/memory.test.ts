import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../src/server/index.js';
import { projectsSource } from '../../../src/server/loops.js';
import { displayPath, readEval, readKnowledge, readRecipeEntries, readRecipes, readTriggers, userRecipeDir } from '../../../src/server/memory.js';
import type { EvalReportData, KnowledgeReport, RecipesReport } from '../../../src/core/types.js';

const RECIPE = `---
id: R-demo
title: Demo recipe
kind: feature
stack: [node@20, vitest@2]
tags: [cli]
status: CONFIRMED
uses: 2
passes: 1
---
## When to use
Always.

## Steps
1. Write it. Proof: \`npm test\`
2. Ship it. Proof: \`npm run build\`

## Checks
- \`npm test\`
`;

let root: string;
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'memory-'));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true, maxRetries: 5 });
});

const put = async (file: string, text: string) => {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text);
};

describe('recipe cards', () => {
  it('shows paths under the home folder as ~ and never an absolute home path', () => {
    const home = path.join(root, 'home');
    expect(displayPath(path.join(home, '.ai', 'recipes', 'a.md'), home)).toBe('~/.ai/recipes/a.md');
    expect(displayPath(path.join(root, 'elsewhere', 'a.md'), home)).not.toContain('~');
  });

  it('userRecipeDir honours LOOP_HOME', () => {
    expect(userRecipeDir({ LOOP_HOME: '/x/loop' }, '/h')).toBe(path.join('/x/loop', 'recipes'));
    expect(userRecipeDir({}, '/h')).toBe(path.join('/h', '.ai', 'recipes'));
  });
});

describe('matching', () => {
  const stored = async (id: string, stack: string[]) => {
    const dir = path.join(root, id);
    await put(path.join(dir, '.ai', 'recipes', 'r.md'), RECIPE.replace('R-demo', id).replace('[node@20, vitest@2]', `[${stack.join(', ')}]`));
    return (await readRecipeEntries([dir], path.join(root, 'none')))[0] as Awaited<ReturnType<typeof readRecipeEntries>>[number];
  };

  it('ranks recipes by core\'s score, drops zero scores and keeps the card fields', async () => {
    await put(path.join(root, 'package.json'), '{"engines":{"node":">=20"},"devDependencies":{"vitest":"^2.1.0"}}');
    const recipes = [await stored('R-a', ['node@20']), await stored('R-b', ['node@20', 'vitest@2']), await stored('R-c', ['go@1']), await stored('R-m', ['node@18'])];
    const { recipes: ranked } = await readKnowledge(root, recipes);
    expect(ranked.map((r) => r.id)).toEqual(['R-b', 'R-a']);
    expect(ranked[0]).toMatchObject({ steps: 2, checks: 1, store: 'project', match: { score: 2, reason: 'stack 2/2' } });
    expect(ranked[0]?.bytes).toBe(Buffer.byteLength(RECIPE.replace('R-demo', 'R-b')));
  });
});

describe('triggers and knowledge', () => {
  it('reads triggers with fired counts and the entry they inject', () => {
    const yaml = '- id: K-1\n  on: error\n  match: x\n  inject: .ai/knowledge/K-1.md\n- id: T-2\n  on: command\n  match: run\n  inject: "run it (K-9)"\n- on: file\n';
    expect(readTriggers(yaml, '{"at":"a","session":"s","id":"K-1","event":"PostToolUse"}\nbroken\n')).toEqual([
      { id: 'K-1', kinds: ['error'], fired: 1, entry: 'K-1' },
      { id: 'T-2', kinds: ['command'], fired: 0, entry: 'K-9' },
    ]);
    expect(readTriggers(undefined, undefined)).toEqual([]);
    expect(readTriggers('{not: a list}', '')).toEqual([]);
  });

  it('reads entries with their lesson, triggers and fired count', async () => {
    await put(path.join(root, '.ai', 'index.md'), '# Index\nK-0001 · forbidden · Host header falls back\n');
    await put(path.join(root, '.ai', 'knowledge', 'K-0001.md'), '---\nid: K-0001\nstatus: confirmed\nfired: 7\n---\nBody line.\n');
    await put(path.join(root, '.ai', 'knowledge', 'K-0002.md'), '---\nid: K-0002\nstatus: guess\nfired: 2\n---\nSecond body.\n');
    await put(path.join(root, '.ai', 'knowledge', 'notes.md'), 'ignored');
    await put(path.join(root, '.ai', 'triggers.yaml'), '- id: K-0001\n  on: error\n  match: forbidden\n  inject: .ai/knowledge/K-0001.md\n');
    await put(path.join(root, '.ai', '.trigger-log.jsonl'), '{"at":"a","session":"s","id":"K-0001","event":"PostToolUse"}\n{"at":"b","session":"s","id":"K-0001","event":"PostToolUse"}\n');
    const report = await readKnowledge(root, []);
    expect(report.entries).toEqual([
      { id: 'K-0001', title: 'Host header falls back', status: 'confirmed', fired: 2, triggerIds: ['K-0001'] },
      { id: 'K-0002', title: 'Second body.', status: 'guess', fired: 2, triggerIds: [] },
    ]);
    expect(report.triggers).toHaveLength(1);
  });

  it('is empty, not an error, for a folder without .ai', async () => {
    expect(await readKnowledge(root, [])).toEqual({ entries: [], triggers: [], recipes: [] });
  });
});

describe('eval', () => {
  const line = (o: Record<string, unknown>) => JSON.stringify({ task: 'calc-page', model: 'haiku', pass: true, inputTokens: 100, outputTokens: 50, durationMs: 60000, turns: 5, ...o });

  it('no results folder gives empty rows and no headline', async () => {
    const report = await readEval([path.join(root, 'evals', 'results')]);
    expect(report.rows).toEqual([]);
    expect(report.headline).toBeUndefined();
    expect(report.sample).toBe(false);
    expect(report.command).toContain('loop eval');
  });

  it('reads the newest results file', async () => {
    const dir = path.join(root, 'evals', 'results');
    await put(path.join(dir, '2026-10-01-haiku.jsonl'), `${line({ arm: 'cold' })}\n`);
    await put(path.join(dir, '2026-10-14-haiku.jsonl'), `${line({ arm: 'cold' })}\n${line({ arm: 'recipe' })}\n`);
    const report = await readEval([dir]);
    expect(report.rows.map((r) => r.arm)).toEqual(['cold', 'recipe']);
    expect(report.headline).toContain('haiku');
    expect(report.rows[0]).toMatchObject({ task: 'calc-page', arm: 'cold', model: 'haiku', medianTokens: 150, medianSeconds: 60 });
  });
});

describe('routes', () => {
  it('serves knowledge, recipes and eval for a local projects folder, with ~ paths', async () => {
    const home = path.join(root, 'home');
    const loop = path.join(root, 'projects', 'site');
    await put(path.join(loop, 'package.json'), '{"name":"site","engines":{"node":">=20"},"devDependencies":{"vitest":"^2.1.0"}}');
    await put(path.join(loop, '.ai', 'recipes', 'demo.md'), RECIPE);
    await put(path.join(loop, '.ai', 'recipes', 'demo.draft.md'), RECIPE.replace('R-demo', 'R-draft'));
    const previous = process.env.LOOP_HOME;
    process.env.LOOP_HOME = path.join(home, '.ai');
    try {
      await put(path.join(home, '.ai', 'recipes', 'mine.md'), RECIPE.replace('R-demo', 'R-mine').replace('node@20', 'go@1'));
      await mkdir(path.join(loop, '.git'), { recursive: true });
      const app = await createApp({ demo: false, source: projectsSource(path.join(root, 'projects')) });
      const recipes = (await (await app.request('/api/recipes')).json()) as RecipesReport;
      expect(recipes.recipes.map((r) => r.id)).toEqual(['R-demo', 'R-mine']);
      expect(JSON.stringify(recipes)).not.toContain(root);
      expect(recipes.recipes.map((r) => r.path)).toEqual(['.ai/recipes/demo.md', '$LOOP_HOME/recipes/mine.md']);
      const knowledge = (await (await app.request('/api/loops/site/knowledge')).json()) as KnowledgeReport;
      expect(knowledge.recipes.map((r) => r.id)).toEqual(['R-demo', 'R-mine']);
      expect(knowledge.recipes[0]?.match?.score).toBe(2);
      expect((await app.request('/api/loops/nope/knowledge')).status).toBe(404);
      const evalRes = await app.request('/api/eval');
      expect(evalRes.status).toBe(200);
      expect(((await evalRes.json()) as EvalReportData).rows).toEqual([]);
    } finally {
      if (previous === undefined) delete process.env.LOOP_HOME;
      else process.env.LOOP_HOME = previous;
    }
  });

  it('serves the demo fixtures, with the eval marked as a sample', async () => {
    const app = await createApp({ demo: true });
    const report = (await (await app.request('/api/eval')).json()) as EvalReportData;
    expect(report.sample).toBe(true);
    expect(report.rows.length).toBeGreaterThan(0);
    expect(report.headline).toBeTruthy();
    const knowledge = (await (await app.request('/api/loops/compounding-loop/knowledge')).json()) as KnowledgeReport;
    expect(knowledge.entries.length).toBeGreaterThan(0);
    expect(knowledge.triggers.some((t) => t.fired > 0)).toBe(true);
    const recipes = (await (await app.request('/api/recipes')).json()) as RecipesReport;
    expect(recipes.recipes).toHaveLength(2);
    expect(recipes.recipes.every((r) => !path.isAbsolute(r.path) && r.bytes <= 6144)).toBe(true);
    expect((await app.request('/api/loops/proj1/knowledge')).status).toBe(200);
    expect((await app.request('/api/loops/nope/knowledge')).status).toBe(404);
  });

  it('readRecipes keeps the first of a duplicate id', async () => {
    await put(path.join(root, 'a', '.ai', 'recipes', 'x.md'), RECIPE);
    await put(path.join(root, 'u', 'x.md'), RECIPE);
    const found = await readRecipes([path.join(root, 'a')], path.join(root, 'u'));
    expect(found.map((r) => r.store)).toEqual(['project']);
  });
});
