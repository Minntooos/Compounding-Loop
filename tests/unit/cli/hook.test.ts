import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formatTriggersReport, runHook, triggersStats } from '../../../src/cli/hook.js';
import { logRun } from '../../../src/cli/runs.js';

const TRIGGERS = `- id: K-1
  on: error
  match: "Could not find claude.exe"
  inject: .ai/knowledge/K-1.md
- id: K-2
  on: file
  match: "src/core/**"
  inject: Core is browser-safe. (K-2)
- id: K-3
  on: command
  match: "git push"
  inject: Pull first.
- id: K-4
  on: topic
  match: crlf
  inject: Mind CRLF.
- id: K-5
  on: file
  match: "*.md"
  inject: ../../outside.md
`;
const RECIPE = `---
id: R-lib
title: Lib
kind: project
stack: [node@20]
tags: []
status: CONFIRMED
source: o/r@abc1234
uses: 0
passes: 0
updated: 2026-10-14
---
# Lib

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

describe('loop hook', () => {
  let dir: string;
  const json = (o: object) => JSON.stringify(o);
  const ctx = (out: string) => (JSON.parse(out) as { hookSpecificOutput: { hookEventName: string; additionalContext: string } }).hookSpecificOutput;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'loop-hook-'));
    process.env.LOOP_HOME = path.join(dir, 'home');
    await mkdir(path.join(dir, '.ai', 'knowledge'), { recursive: true });
    await mkdir(path.join(dir, '.ai', 'recipes'), { recursive: true });
    await mkdir(path.join(dir, '.ai', 'lanes', 'core'), { recursive: true });
    await writeFile(path.join(dir, '.ai', 'triggers.yaml'), TRIGGERS);
    await writeFile(path.join(dir, '.ai', 'knowledge', 'K-1.md'), '---\nid: K-1\n---\n# Claude missing\nCheck the abort signal first.');
    await writeFile(path.join(dir, '.ai', 'recipes', 'R-lib.md'), RECIPE);
    await writeFile(path.join(dir, 'package.json'), '{"engines":{"node":">=20"}}');
    await writeFile(path.join(dir, '.ai', 'lanes.json'), JSON.stringify({ lanes: [{ name: 'core', owns: ['src/**'] }] }));
  });
  afterEach(() => rm(dir, { recursive: true, force: true, maxRetries: 5 }));

  it('PostToolUseFailure: injects a knowledge entry on an error, with the exact output shape', async () => {
    const out = await runHook('PostToolUseFailure', json({ session_id: 's1', tool_name: 'Bash', error: 'Error: Could not find claude.exe on PATH' }), dir);
    expect(ctx(out)).toEqual({ hookEventName: 'PostToolUseFailure', additionalContext: '# Claude missing\nCheck the abort signal first.' });
    expect(Object.keys(JSON.parse(out))).toEqual(['hookSpecificOutput']);
  });

  it('PostToolUse and PostToolUseFailure match a file the tool touched (absolute paths become repo-relative)', async () => {
    const file = path.join(dir, 'src', 'core', 'a.ts');
    expect(ctx(await runHook('PostToolUse', json({ session_id: 's', tool_name: 'Edit', tool_input: { file_path: file } }), dir)).additionalContext).toBe('Core is browser-safe. (K-2)');
    expect(await runHook('PostToolUse', json({ session_id: 's2', tool_name: 'Edit', tool_input: { file_path: path.join(tmpdir(), 'x', 'core.ts') } }), dir)).toBe('');
  });

  it('PreToolUse matches Bash commands only', async () => {
    expect(ctx(await runHook('PreToolUse', json({ session_id: 's', tool_name: 'Bash', tool_input: { command: 'git push origin main' } }), dir)).additionalContext).toBe('Pull first.');
    expect(await runHook('PreToolUse', json({ session_id: 's3', tool_name: 'Read', tool_input: { command: 'git push' } }), dir)).toBe('');
  });

  it('UserPromptSubmit matches topics', async () => {
    expect(ctx(await runHook('UserPromptSubmit', json({ session_id: 's', prompt: 'why CRLF?' }), dir)).hookEventName).toBe('UserPromptSubmit');
    expect(await runHook('UserPromptSubmit', json({ session_id: 's4', prompt: 'hello' }), dir)).toBe('');
  });

  it('SessionStart names the best recipe, and nothing when none scores', async () => {
    const out = ctx(await runHook('SessionStart', json({ session_id: 's' }), dir));
    expect(out.additionalContext).toBe('Recipe for this repo: R-lib (stack 1/1). Run `loop recipe show R-lib --context` for its steps and checks.');
    await writeFile(path.join(dir, 'package.json'), '{}');
    expect(await runHook('SessionStart', json({ session_id: 'other' }), dir)).toBe('');
  });

  it('injects each trigger once per session, logs every fire, and a new session fires again', async () => {
    const stdin = (session_id: string) => json({ session_id, tool_name: 'Bash', tool_input: { command: 'git push' } });
    expect(await runHook('PreToolUse', stdin('a'), dir)).not.toBe('');
    expect(await runHook('PreToolUse', stdin('a'), dir)).toBe('');
    expect(await runHook('PreToolUse', stdin('b'), dir)).not.toBe('');
    const lines = (await readFile(path.join(dir, '.ai', '.trigger-log.jsonl'), 'utf8')).trim().split('\n').map((l) => JSON.parse(l) as Record<string, string>);
    expect(lines.map((l) => [l.session, l.id, l.event])).toEqual([['a', 'K-3', 'PreToolUse'], ['b', 'K-3', 'PreToolUse']]);
    expect(lines[0]?.at).toMatch(/^\d{4}-\d\d-\d\dT/);
  });

  it('never reads an inject path outside the repo, and prints nothing for unknown events or empty stdin', async () => {
    await writeFile(path.join(path.dirname(dir), 'outside.md'), 'secret');
    expect(await runHook('PostToolUse', json({ session_id: 'x', tool_name: 'Read', tool_input: { file_path: path.join(dir, 'README.md') } }), dir)).toBe('');
    expect(await runHook('Stop', '{}', dir)).toBe('');
    expect(await runHook('PreToolUse', '', dir)).toBe('');
  });

  it('triggers stats counts fires, lists never-fired ids and the run log records the count', async () => {
    await runHook('PreToolUse', json({ session_id: 'a', tool_name: 'Bash', tool_input: { command: 'git push' } }), dir);
    const report = await triggersStats(dir);
    expect(report.total).toBe(1);
    expect(report.stats[0]).toMatchObject({ id: 'K-3', fired: 1 });
    expect(report.stats.at(-1)).toMatchObject({ fired: 0 });
    expect(formatTriggersReport(report)).toContain('K-3');
    expect(formatTriggersReport({ stats: [], total: 0, problems: [] })).toMatch(/No triggers yet/);
    expect((await logRun(dir, 'core', { pushed: false, triggers: report.total })).triggers).toBe(1);
    await expect(logRun(dir, 'core', { pushed: false, triggers: -1 })).rejects.toThrow(/--triggers/);
  });

  it('the CLI exits 0 and prints nothing on bad stdin, and prints the exact shape on a match', async () => {
    const hook = (event: string, stdin: string) =>
      new Promise<{ code: number | null; stdout: string }>((resolve) => {
        const child = spawn(process.execPath, ['--import', 'tsx', path.resolve('src/cli/index.ts'), 'hook', event], { env: { ...process.env, CLAUDE_PROJECT_DIR: dir, LOOP_HOME: path.join(dir, 'home') } });
        let stdout = '';
        child.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
        child.on('close', (code) => resolve({ code, stdout }));
        child.stdin.end(stdin);
      });
    expect(await hook('PreToolUse', '{not json')).toEqual({ code: 0, stdout: '' });
    const ok = await hook('UserPromptSubmit', json({ session_id: 'cli', prompt: 'crlf' }));
    expect(ok.code).toBe(0);
    expect(ctx(ok.stdout)).toEqual({ hookEventName: 'UserPromptSubmit', additionalContext: 'Mind CRLF.' });
  }, 60_000);
});
