import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runCheckLanes } from '../../../src/cli/checkLanes.js';
import { runAddLanes } from '../../../src/cli/lanesInit.js';

const tsx = path.resolve('node_modules/tsx/dist/cli.mjs');
const cli = path.resolve('src/cli/index.ts');
const loop = (dir: string, ...args: string[]) => execFileSync(process.execPath, [tsx, cli, ...args], { cwd: dir, encoding: 'utf8', stdio: 'pipe' });

describe('lanes init', () => {
  let dir: string;
  beforeEach(async () => { dir = await mkdtemp(path.join(tmpdir(), 'loop-linit-')); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true, maxRetries: 5 }); });
  const read = (rel: string) => readFile(path.join(dir, ...rel.split('/')), 'utf8');

  it('runAddLanes writes the files, and a second run changes nothing', async () => {
    const lanes = [{ name: 'api', owns: ['src/api/**'] }, { name: 'ui', owns: ['src/ui/**'] }];
    const first = await runAddLanes(dir, lanes, { force: false, dryRun: false, existingOk: true });
    expect(first.actions.filter((a) => a.kind !== 'skip').length).toBeGreaterThan(5);
    const config = JSON.parse(await read('.ai/lanes.json')) as { lanes: { cron: string }[] };
    expect(config.lanes.map((l) => l.cron)).toEqual(['7 * * * *', '19 * * * *']);
    await writeFile(path.join(dir, '.ai', 'lanes', 'api', 'task.md'), 'my progress');
    const second = await runAddLanes(dir, lanes, { force: true, dryRun: false, existingOk: true });
    expect(second.actions.every((a) => a.kind === 'skip')).toBe(true);
    expect(await read('.ai/lanes/api/task.md')).toBe('my progress');
  });

  it('dry run writes nothing; add errors on a duplicate lane', async () => {
    await runAddLanes(dir, [{ name: 'api', owns: ['src/api/**'] }], { force: false, dryRun: true });
    await expect(read('.ai/lanes.json')).rejects.toThrow();
    await runAddLanes(dir, [{ name: 'api', owns: ['src/api/**'] }], { force: false, dryRun: false });
    await expect(runAddLanes(dir, [{ name: 'api', owns: ['x/**'] }], { force: false, dryRun: false })).rejects.toThrow(/already exists/);
  });

  it('rejects an invalid existing lanes.json with a message', async () => {
    await runAddLanes(dir, [{ name: 'api', owns: ['a/**'] }], { force: false, dryRun: false });
    await writeFile(path.join(dir, '.ai', 'lanes.json'), '{nope');
    await expect(runAddLanes(dir, [{ name: 'ui', owns: ['b/**'] }], { force: false, dryRun: false })).rejects.toThrow(/invalid/);
  });

  it('the CLI sets up a repo whose check-lanes passes, and a crossing commit fails it', async () => {
    const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 't@example.com'); git('config', 'user.name', 'T'); git('config', 'commit.gpgsign', 'false');
    await writeFile(path.join(dir, 'IDEA.md'), '# x\n');
    const out = loop(dir, 'init', '--lanes', 'a,b', '--force');
    expect(out).toMatch(/create\s+\.ai\/lanes\.json/);
    await expect(read('.ai/task.md')).rejects.toThrow();
    loop(dir, 'lanes', 'add', 'c', '--owns', 'c/**', 'docs/**');
    expect(JSON.parse(await read('.ai/lanes.json')).lanes.map((l: { name: string }) => l.name)).toEqual(['a', 'b', 'c']);
    expect(await read('CLAUDE.md')).toContain('Lanes in this repo: a, b, c');
    git('add', '-A'); git('commit', '-q', '-m', 'setup\n\nLane: control');
    expect((await runCheckLanes(dir)).problems).toEqual([]);
    await writeFile(path.join(dir, 'a-file.txt'), 'x');
    git('add', '-A'); git('commit', '-q', '-m', 'oops\n\nLane: a');
    expect((await runCheckLanes(dir)).problems[0]).toMatch(/no lane owns it/);
  });
});
