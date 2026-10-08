import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadPromptText, runRound, type Spawner } from '../../../src/cli/run.js';

const tsx = path.resolve('node_modules/.bin/tsx');
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
    expect(calls).toEqual([{ command: 'claude', args: ['-p', `Build ${path.basename(dir)}\n`, '--permission-mode', 'acceptEdits'], cwd: dir }]);
  });

  it('does nothing when DONE.md or BLOCKED.md exists, and on --dry-run', async () => {
    await writeFile(path.join(dir, 'BLOCKED.md'), 'x');
    expect((await runRound(dir, { dryRun: false, skipPermissions: false }, fake)).skipped).toMatch(/BLOCKED.md/);
    await rm(path.join(dir, 'BLOCKED.md'));
    await runRound(dir, { dryRun: true, skipPermissions: false }, fake);
    expect(calls).toEqual([]);
  });

  it('prints the prompt through the CLI on --dry-run', () => {
    const out = execFileSync(tsx, [cli, 'run', dir, '--dry-run'], { encoding: 'utf8' });
    expect(out).toContain('Prompt from built-in default');
    expect(out).toContain('unattended build loop');
  });
});
