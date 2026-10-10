import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadPromptText, lockMinutesLeft, resolveExecutable, resolveInvocation, runRound, type Spawner } from '../../../src/cli/run.js';

// Run tsx's CLI through node: node_modules/.bin/tsx is a .cmd shim on Windows, which execFile cannot start.
const tsx = path.resolve('node_modules/tsx/dist/cli.mjs');
const cli = path.resolve('src/cli/index.ts');

describe('loop run', () => {
  let dir: string;
  const calls: { command: string; args: string[]; cwd: string }[] = [];
  const fake: Spawner = async (command, args, cwd) => { calls.push({ command, args, cwd }); return 0; };
  beforeEach(async () => { dir = await mkdtemp(path.join(tmpdir(), 'loop-run-')); calls.length = 0; });
  afterEach(async () => { await rm(dir, { recursive: true, force: true, maxRetries: 5 }); });

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
    expect(calls).toEqual([{ command: 'claude', args: ['-p', expect.stringMatching(new RegExp(`^Build ${path.basename(dir)}\\n\\nNote from `)), '--permission-mode', 'acceptEdits', '--allowedTools', 'Bash,Edit,Write,Read,Glob,Grep,Agent,WebSearch'], cwd: dir }]);
  });

  describe('--lane', () => {
    const lanesJson = JSON.stringify({ lanes: [{ name: 'api', owns: ['src/api/**'] }, { name: 'ui', owns: ['src/ui/**'] }], shared: [] });
    const lockFile = () => path.join(dir, '.ai', 'lanes', 'api', 'session.lock');
    beforeEach(async () => {
      await mkdir(path.join(dir, '.ai', 'lanes', 'api'), { recursive: true });
      await writeFile(path.join(dir, '.ai', 'lanes.json'), lanesJson);
    });

    it('writes the lane lock while claude runs and clears it afterwards', async () => {
      let during: string | undefined;
      const spawner: Spawner = async (_c, args) => { during = await readFile(lockFile(), 'utf8'); calls.push({ command: 'claude', args, cwd: dir }); return 0; };
      const result = await runRound(dir, { dryRun: false, skipPermissions: false, lane: 'api' }, spawner);
      expect(during).toMatch(/^\d{4}-\d\d-\d\dT/);
      await expect(readFile(lockFile())).rejects.toThrow();
      expect(result.prompt).toContain('**api** lane');
      expect(result.prompt).toContain('Lane: api');
      expect(result.prompt).toContain('.ai/lanes/api/session.lock');
    });

    it('clears the lock when the runner fails', async () => {
      const boom: Spawner = async () => { throw new Error('claude exploded'); };
      await expect(runRound(dir, { dryRun: false, skipPermissions: false, lane: 'api' }, boom)).rejects.toThrow(/exploded/);
      await expect(readFile(lockFile())).rejects.toThrow();
    });

    it('stops for the lane\'s own DONE/BLOCKED and fresh lock, but not for another lane\'s', async () => {
      await mkdir(path.join(dir, '.ai', 'lanes', 'ui'), { recursive: true });
      await writeFile(path.join(dir, '.ai', 'lanes', 'ui', 'DONE.md'), 'x');
      expect((await runRound(dir, { dryRun: false, skipPermissions: false, lane: 'api' }, fake)).exitCode).toBe(0);
      await writeFile(path.join(dir, '.ai', 'lanes', 'api', 'BLOCKED.md'), 'x');
      expect((await runRound(dir, { dryRun: false, skipPermissions: false, lane: 'api' }, fake)).skipped).toMatch(/BLOCKED.md/);
      await rm(path.join(dir, '.ai', 'lanes', 'api', 'BLOCKED.md'));
      await writeFile(lockFile(), new Date().toISOString());
      expect((await runRound(dir, { dryRun: false, skipPermissions: false, lane: 'api' }, fake)).skipped).toMatch(/session\.lock/);
    });

    it('rejects an unknown lane or a missing lanes.json with the fix', async () => {
      await expect(runRound(dir, { dryRun: true, skipPermissions: false, lane: 'ghost' }, fake)).rejects.toThrow(/Lanes in .ai\/lanes.json: api, ui/);
      await rm(path.join(dir, '.ai', 'lanes.json'));
      await expect(runRound(dir, { dryRun: true, skipPermissions: false, lane: 'api' }, fake)).rejects.toThrow(/loop init --lanes/);
    });

    it('prefers a lane prompt file from the repo', async () => {
      await writeFile(path.join(dir, '.ai', 'lanes', 'api', 'prompt.md'), 'Lane {{lane}} of {{name}}');
      expect((await loadPromptText(dir, dir, 'api')).text).toBe('Lane {{lane}} of {{name}}');
    });
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
    expect(await resolveExecutable('C:\\node\\node.exe', 'win32', '', has([]))).toBe('C:\\node\\node.exe');
    await expect(resolveExecutable('C:\\tools\\claude.cmd', 'win32', '', has([]))).rejects.toThrow(/cannot start/);
  });

  it('runs a Windows npm shim through its package entry with node', async () => {
    const has = async (f: string) => f === 'C:\\npm\\claude.cmd';
    const files: Record<string, string> = {
      'C:\\npm\\node_modules\\@anthropic-ai\\claude-code\\package.json': JSON.stringify({ bin: { claude: 'cli.js' } }),
    };
    const read = async (f: string) => files[f];
    expect(await resolveInvocation('claude', ['-p', 'hi'], 'win32', 'C:\\npm', has, read, 'C:\\node.exe')).toEqual({
      command: 'C:\\node.exe',
      args: ['C:\\npm\\node_modules\\@anthropic-ai\\claude-code\\cli.js', '-p', 'hi'],
    });
    await expect(resolveInvocation('claude', [], 'win32', 'C:\\npm', has, async () => undefined)).rejects.toThrow(/native claude.exe/);
    expect(await resolveInvocation('claude', ['x'], 'linux')).toEqual({ command: 'claude', args: ['x'] });
  });

  it('prints the prompt through the CLI on --dry-run', () => {
    const out = execFileSync(process.execPath, [tsx, cli, 'run', dir, '--dry-run'], { encoding: 'utf8' });
    expect(out).toMatch(/Prompt from .*prompt\.md|Prompt from built-in default/);
    expect(out).toContain('build loop');
  });
});
