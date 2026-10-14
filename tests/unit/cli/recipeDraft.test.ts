import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildRecipeDraftPrompt } from '../../../src/core/recipeDraft.js';
import { gatherRecipePrompt, runRecipeDraft } from '../../../src/cli/recipeDraft.js';

const GOOD = (id: string) => `---
id: ${id}
title: T
kind: feature
stack: [node@20]
tags: [x]
status: GUESS
source: o/r@abc1234
uses: 0
passes: 0
updated: 2026-10-14
---
# T

## When to use
x

## Steps
1. Do. (proof: \`npm test\`)

## Traps
- t

## Checks
- \`npm test\`

## Start from
- a
`;

describe('recipe draft', () => {
  let dir: string;
  const noClaude = () => { throw new Error('Claude must not be called'); };
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'loop-rdraft-'));
    process.env.LOOP_HOME = path.join(dir, 'home');
    await mkdir(path.join(dir, '.ai', 'lanes', 'api'), { recursive: true });
    await mkdir(path.join(dir, '.ai', 'knowledge'), { recursive: true });
    await writeFile(path.join(dir, '.ai', 'lanes.json'), JSON.stringify({ lanes: [{ name: 'api', owns: ['src/**'] }] }));
    await writeFile(path.join(dir, '.ai', 'lanes', 'api', 'DONE.md'), '# Done\nBuilt the endpoint.');
    await writeFile(path.join(dir, '.ai', 'lanes', 'api', 'task.md'), '# t\n\n## Decisions\n- use hono\n\n## Tried\n- express failed\n\n## Don\'t\n- skip tests\n');
    await writeFile(path.join(dir, '.ai', 'lanes', 'api', 'runs.jsonl'), '{"lane":"api","note":"run 1"}\n');
    await writeFile(path.join(dir, '.ai', 'knowledge', 'K-0001.md'), '---\nid: K-0001\ntype: gotcha\n---\n# Host header guard\nbody');
  });
  afterEach(() => rm(dir, { recursive: true, force: true, maxRetries: 5 }));

  it('--print-prompt builds the prompt from DONE, notes, knowledge and runs without calling Claude', async () => {
    const r = await runRecipeDraft(dir, { from: 'api', printPrompt: true, claude: noClaude });
    expect(r.draft).toBeUndefined();
    for (const part of ['Built the endpoint.', 'use hono', 'express failed', 'skip tests', 'K-0001 gotcha: Host header guard', '"run 1"', 'Delta rule']) expect(r.prompt).toContain(part);
    expect(r.prompt).not.toContain(dir);
  });

  it('--from accepts a folder inside the repo and rejects other places', async () => {
    await mkdir(path.join(dir, 'sub', '.ai'), { recursive: true });
    await writeFile(path.join(dir, 'sub', 'DONE.md'), 'Sub work');
    expect(await gatherRecipePrompt(dir, { from: 'sub' })).toContain('Sub work');
    await expect(gatherRecipePrompt(dir, { from: '..' })).rejects.toThrow(/inside the repo/);
    await expect(gatherRecipePrompt(dir, { from: 'nope' })).rejects.toThrow(/neither a lane/);
  });

  it('writes the draft next to the recipes and scores it', async () => {
    const r = await runRecipeDraft(dir, { claude: async () => GOOD('R-new') });
    expect(r).toMatchObject({ outFile: '.ai/recipes/R-new.draft.md', problems: [] });
    expect(await readFile(path.join(dir, '.ai', 'recipes', 'R-new.draft.md'), 'utf8')).toContain('R-new');
  });

  it('reports problems of a bad draft, never writes a bad id, and treats an existing id as a delta', async () => {
    expect((await runRecipeDraft(dir, { claude: async () => GOOD('R-ok').replace('(proof: `npm test`)', '') })).problems?.[0]).toMatch(/Step 1/);
    const evil = await runRecipeDraft(dir, { claude: async () => GOOD('../../evil') });
    expect(evil.outFile).toBeUndefined();
    expect(evil.problems?.join()).toMatch(/R-<slug>/);
    await mkdir(path.join(dir, '.ai', 'recipes'), { recursive: true });
    await writeFile(path.join(dir, '.ai', 'recipes', 'R-old.md'), GOOD('R-old'));
    const delta = await runRecipeDraft(dir, { id: 'R-old', claude: async () => '### Add\n- Steps: x' });
    expect(delta.delta).toBe(true);
    expect(delta.outFile).toBeUndefined();
    expect(await readFile(path.join(dir, '.ai', 'recipes', 'R-old.md'), 'utf8')).toBe(GOOD('R-old'));
    await expect(runRecipeDraft(dir, { claude: async () => '  ' })).rejects.toThrow(/empty draft/);
  });

  it('the pure prompt names the id rule and caps long inputs', () => {
    const p = buildRecipeDraftPrompt({ source: 's', done: 'x'.repeat(5000), notes: [], knowledge: [], runs: [], existingIds: ['R-a'], id: 'R-a' });
    expect(p).toContain('already exists: answer with a DELTA');
    expect(p).toContain('[…cut]');
    expect(buildRecipeDraftPrompt({ source: 's', notes: [], knowledge: [], runs: [], existingIds: [] })).toContain('(no recipes yet)');
  });
});
