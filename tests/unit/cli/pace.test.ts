import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formatPaceReport, readPolicy, runPaceSet, runPaceShow } from '../../../src/cli/pace.js';

describe('loop pace', () => {
  let dir: string;
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'loop-pace-'));
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 't@example.com');
    git('config', 'user.name', 'Tess');
    git('config', 'commit.gpgsign', 'false');
    await mkdir(path.join(dir, '.ai'), { recursive: true });
    await writeFile(path.join(dir, '.ai', 'lanes.json'), JSON.stringify({ lanes: [{ name: 'api', owns: ['src/**'] }] }));
    git('add', '-A');
    git('commit', '-qm', 'init');
  });
  afterEach(() => rm(dir, { recursive: true, force: true, maxRetries: 5 }));

  it('show: balanced without a file; lists overrides', async () => {
    expect(await runPaceShow(dir)).toEqual({ pace: 'balanced', overrides: {} });
    await runPaceSet(dir, 'sprint', { lane: 'api', push: false });
    const report = await runPaceShow(dir);
    expect(report.overrides).toEqual({ api: 'sprint' });
    expect(formatPaceReport(report)).toContain('api');
  });

  it('show warns when the file is present but unusable', async () => {
    await writeFile(path.join(dir, '.ai', 'policy.json'), '{oops');
    const report = await runPaceShow(dir);
    expect(report.pace).toBe('balanced');
    expect(formatPaceReport(report)).toContain('warning: .ai/policy.json is not valid JSON');
  });

  it('set writes the file and commits with Lane: control', async () => {
    const r = await runPaceSet(dir, 'careful', { push: false });
    expect(r).toMatchObject({ changed: ['all'], committed: true });
    expect((await readPolicy(dir)).pace).toBe('careful');
    expect(git('log', '-1', '--format=%B')).toContain('Lane: control');
    expect(git('status', '--porcelain')).toBe('');
  });

  it('set to the current value changes nothing once the file exists', async () => {
    await runPaceSet(dir, 'fast', { push: false });
    expect((await runPaceSet(dir, 'fast', { push: false })).changed).toEqual([]);
  });

  it('--no-commit writes but does not commit; bad preset and unknown lane are errors', async () => {
    const r = await runPaceSet(dir, 'fast', { commit: false });
    expect(r.committed).toBe(false);
    expect(await readFile(path.join(dir, '.ai', 'policy.json'), 'utf8')).toContain('"fast"');
    await expect(runPaceSet(dir, 'warp')).rejects.toThrow(/not a pace/);
    await expect(runPaceSet(dir, 'fast', { lane: 'nope', commit: false })).rejects.toThrow(/No lane/);
  });
});
