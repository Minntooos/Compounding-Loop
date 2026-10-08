import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadPromptText, lockMinutesLeft, resolveExecutable, runRound, type Spawner } from '../../../src/cli/run.js';

// Run tsx's CLI through node: node_modules/.bin/tsx is a .cmd shim on Windows, which execFile cannot start.
const tsx = path.resolve('node_modules/tsx/dist/cli.mjs');
const cli = path.resolve('src/cli/index.ts');

describe('loop run', () => {
  let dir: string;
  const calls: { command: string; args: string[]; cwd: string }[] = [];
  const fake: Spawner = async (command, args, cwd) => { calls.push({ command, args, cwd }); return 0; };
  beforeEach(async () => { dir = await mkdtemp(path.join(tmpdir(), 'loop-run-')); calls.length = 0; });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  it('prefers the repo prompt, then falls back to the built-in default', async () => {
    expect((await loadPromptText(dir, dir)).source).toBe('built-in default');
    await mkdir(path.join(dir, '.ai'));
    await writeFile(path.join(dir, '.ai', 'loop-prompt.md'), 'Build {{name}}');
    expect((await loadPromptText(dir, dir)).text).toBe('Build {{name}}');
  });

  it('starts claude in the loop folder with the filled prompt, never a shell', async () => {
    await mkdir(path.join(dir, '.ai'));
    await writeFile(path.join(dir, '.ai', 'loop-prompt.md'), 'Build {{name}}');
    const result = await runRound(dir, { dryRun: false, skipPermissions: false }, fake);
    expect(result.exitCode).toBe(0);
    expect(calls).toEqual([{ command: 'claude', args: ['-p', `Build ${path.basename(dir)}\n`, '--permission-mode', 'acceptEdits', '--allowedTools', 'Bash,Edit,Write,Read,Glob,Grep,Agent,WebSearch'], cwd: dir }]);
  });

  it('does nothing when DONE.md or BLOCKED.md exists, and on --dry-run', async () => {
    await writeFile(path.join(dir, 'BLOCKED.md'), 'x');
    expect((await runRound(dir, { dryRun: false, skipPermissions: false }, fake)).skipped).toMatch(/BLOCKED.md/);
    await rm(path.join(dir, 'BLOCKED.md'));
    await runRound(dir, { dryRun: true, skipPermissions: false }, fake);
    expect(calls).toEqual([]);
  });

  it('stands down while a fresh session.lock is held and ignores a stale one', async () => {
    await mkdir(path.join(dir, '.ai'));
    await writeFile(path.join(dir, '.ai', 'session.lock'), new Date().toISOString());
    expect((await runRound(dir, { dryRun: false, skipPermissions: false }, fake)).skipped).toMatch(/session\.lock/);
    await writeFile(path.join(dir, '.ai', 'session.lock'), new Date(Date.now() - 3 * 3_600_000).toISOString());
    expect((await runRound(dir, { dryRun: false, skipPermissions: false }, fake)).exitCode).toBe(0);
    expect(calls).toHaveLength(1);
  });

  it('computes the lock window', () => {
    const now = new Date('2026-10-08T06:00:00Z');
    expect(lockMinutesLeft('2026-10-08T05:30:00Z', now)).toBe(60);
    expect(lockMinutesLeft('2026-10-08T04:00:00Z', now)).toBeUndefined();
    expect(lockMinutesLeft('garbage', now)).toBeUndefined();
    expect(lockMinutesLeft(undefined, now)).toBeUndefined();
  });

  it('appends one line to .ai/runs.jsonl per round', async () => {
    await runRound(dir, { dryRun: false, skipPermissions: false }, fake);
    const [line] = (await readFile(path.join(dir, '.ai', 'runs.jsonl'), 'utf8')).trim().split('\n');
    expect(Object.keys(JSON.parse(line ?? '{}'))).toEqual(['startedAt', 'endedAt']);
  });

  it('resolves claude per platform without a shell', async () => {
    expect(await resolveExecutable('claude', 'linux')).toBe('claude');
    const has = (set: string[]) => async (f: string) => set.includes(f);
    expect(await resolveExecutable('claude', 'win32', 'C:\\a;C:\\b', has(['C:\\b\\claude.exe']))).toBe('C:\\b\\claude.exe');
    await expect(resolveExecutable('claude', 'win32', 'C:\\a', has(['C:\\a\\claude.cmd']))).rejects.toThrow(/native claude.exe/);
    await expect(resolveExecutable('claude', 'win32', 'C:\\a', has([]))).rejects.toThrow(/Could not find/);
  });

  it('prints the prompt through the CLI on --dry-run', () => {
    const out = execFileSync(process.execPath, [tsx, cli, 'run', dir, '--dry-run'], { encoding: 'utf8' });
    expect(out).toMatch(/Prompt from .*prompt\.md|Prompt from built-in default/);
    expect(out).toContain('build loop');
  });
});
