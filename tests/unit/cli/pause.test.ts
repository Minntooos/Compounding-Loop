import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runCheckLanes } from '../../../src/cli/checkLanes.js';
import { readPaused, runPause, runResume } from '../../../src/cli/pause.js';
import { runRound } from '../../../src/cli/run.js';
import { runStatus } from '../../../src/cli/loops.js';
import { describePaused, formatPaused, isPaused, parsePaused } from '../../../src/core/parse/paused.js';

describe('PAUSED file format', () => {
  const at = new Date('2026-10-11T12:30:00.000Z');
  it('round-trips with and without a reason', () => {
    expect(parsePaused(formatPaused('Ana B', at))).toEqual({ by: 'Ana B', at });
    expect(parsePaused(formatPaused('Ana', at, 'usage limit'))).toEqual({ by: 'Ana', at, reason: 'usage limit' });
  });
  it('still reads hand-written files: the file alone pauses', () => {
    expect(parsePaused('')).toEqual({ by: 'unknown' });
    expect(parsePaused('on holiday\n')).toEqual({ by: 'on holiday' });
    expect(parsePaused('Ana · paused not-a-date')).toEqual({ by: 'Ana · paused not-a-date' });
    expect(parsePaused(`\r\nAna · paused ${at.toISOString()}\r\n`).by).toBe('Ana');
  });
  it('isPaused looks for the file in a path list, also with Windows separators', () => {
    expect(isPaused(['DONE.md', '.ai/PAUSED'])).toBe(true);
    expect(isPaused(['.ai\\PAUSED'])).toBe(true);
    expect(isPaused(['.ai/lanes/web/PAUSED', 'PAUSED'])).toBe(false);
  });
  it('describes who and when', () => {
    expect(describePaused({ by: 'Ana', at, reason: 'limit' })).toBe('Paused by Ana since 2026-10-11 12:30 UTC (limit)');
    expect(describePaused({ by: 'Ana' })).toBe('Paused by Ana');
  });
});

describe('loop pause / resume', () => {
  let dir: string;
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  const file = () => path.join(dir, '.ai', 'PAUSED');
  const now = new Date('2026-10-11T10:00:00Z');

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'loop-pause-'));
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 't@example.com');
    git('config', 'user.name', 'Tess');
    git('config', 'commit.gpgsign', 'false');
    await mkdir(path.join(dir, '.ai'));
    await writeFile(path.join(dir, '.ai', 'lanes.json'), JSON.stringify({ lanes: [{ name: 'api', owns: ['src/**', '.ai/lanes/api/**'] }] }));
    git('add', '-A');
    git('commit', '-qm', 'init');
  });
  afterEach(() => rm(dir, { recursive: true, force: true, maxRetries: 5 }));

  it('pause writes the file, commits it with Lane: control and leaves the tree clean', async () => {
    const r = await runPause(dir, { push: false, now, reason: 'usage   limit' });
    expect(r).toMatchObject({ changed: true, paused: true, by: 'Tess' });
    expect(await readFile(file(), 'utf8')).toBe('Tess · paused 2026-10-11T10:00:00.000Z · usage limit\n');
    expect(git('log', '-1', '--format=%B')).toContain('Lane: control');
    expect(git('status', '--porcelain')).toBe('');
    expect(await readPaused(dir)).toMatchObject({ by: 'Tess', reason: 'usage limit' });
  });

  it('pausing twice keeps the first pause', async () => {
    await runPause(dir, { push: false, now, as: 'Sam' });
    const again = await runPause(dir, { push: false, now, as: 'Ana' });
    expect(again).toEqual({ changed: false, paused: true, by: 'Sam' });
    expect(git('rev-list', '--count', 'HEAD').trim()).toBe('2');
  });

  it('rejects a missing or unusable name', async () => {
    await expect(runPause(dir, { push: false, as: 'a · b' })).rejects.toThrow(/--as/);
  });

  it('resume removes the file and commits; resuming when not paused is a no-op', async () => {
    await runPause(dir, { push: false, now });
    const r = await runResume(dir, { push: false });
    expect(r).toEqual({ changed: true, paused: false });
    await expect(stat(file())).rejects.toThrow();
    expect(git('log', '-1', '--format=%B')).toContain('Lane: control');
    expect(await runResume(dir, { push: false })).toEqual({ changed: false, paused: false });
  });

  it('resume also clears an untracked, hand-made PAUSED without committing', async () => {
    await writeFile(file(), 'me\n');
    expect(await runResume(dir, { push: false })).toEqual({ changed: true, paused: false });
    await expect(stat(file())).rejects.toThrow();
  });

  it('reports a failed push without losing the commit', async () => {
    const r = await runPause(dir, { now });
    expect(r.changed).toBe(true);
    expect(r.pushed).toBe(false);
    expect(r.pushError).toBeTruthy();
  });

  it('check-lanes accepts pause and resume commits', async () => {
    await runPause(dir, { push: false, now });
    await runResume(dir, { push: false });
    expect((await runCheckLanes(dir)).problems).toEqual([]);
  });

  it('loop run stops on PAUSED before starting claude, naming who paused', async () => {
    await runPause(dir, { push: false, now, as: 'Sam', reason: 'limit' });
    let spawned = false;
    const r = await runRound(dir, { dryRun: false, skipPermissions: false }, async () => { spawned = true; return 0; });
    expect(spawned).toBe(false);
    expect(r.skipped).toMatch(/Paused by Sam.*loop resume/);
    const lane = await runRound(dir, { dryRun: false, skipPermissions: false, lane: 'api' }, async () => 0);
    expect(lane.skipped).toMatch(/Paused by Sam/);
  });

  it('loop status shows the pause', async () => {
    await runPause(dir, { push: false, now, as: 'Sam', reason: 'limit' });
    expect(await runStatus([dir], now)).toMatch(/Paused by Sam since 2026-10-11 10:00 UTC \(limit\)\. `loop resume`/);
  });

  it('is wired into the CLI (pause, then resume, end to end)', () => {
    const run = (...args: string[]) => execFileSync(process.execPath, [path.resolve('node_modules/tsx/dist/cli.mjs'), path.resolve('src/cli/index.ts'), ...args, '--no-push', '--dir', dir], { encoding: 'utf8' });
    expect(run('pause', '--as', 'Sam', '--reason', 'break')).toMatch(/^Paused\./);
    expect(run('pause', '--as', 'Sam')).toMatch(/Already paused by Sam/);
    expect(run('resume')).toMatch(/^Resumed\./);
    expect(run('resume')).toMatch(/Not paused/);
  });
});

describe('loop pause rollback', () => {
  it('leaves no PAUSED behind when the commit fails', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'loop-pause-rb-'));
    try {
      execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
      await writeFile(path.join(dir, '.gitignore'), '.ai/\n');
      await expect(runPause(dir, { push: false, as: 'Sam' })).rejects.toThrow();
      expect(await readPaused(dir)).toBeUndefined();
    } finally {
      await rm(dir, { recursive: true, force: true, maxRetries: 5 });
    }
  });
});
