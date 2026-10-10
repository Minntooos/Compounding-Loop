import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formatLaneCheck, runCheckLanes } from '../../../src/cli/checkLanes.js';

const tsx = path.resolve('node_modules/tsx/dist/cli.mjs');
const cli = path.resolve('src/cli/index.ts');

describe('loop check-lanes', () => {
  let dir: string;
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  const commit = async (file: string, message: string) => {
    await mkdir(path.dirname(path.join(dir, file)), { recursive: true });
    await writeFile(path.join(dir, file), `${Math.random()}`);
    git('add', '-A');
    git('commit', '-q', '-m', message);
  };

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'loop-lanes-'));
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 't@example.com');
    git('config', 'user.name', 'T');
    git('config', 'commit.gpgsign', 'false');
    await mkdir(path.join(dir, '.ai'));
    await writeFile(path.join(dir, '.ai', 'lanes.json'), JSON.stringify({
      lanes: [{ name: 'api', owns: ['src/api/**'] }, { name: 'ui', owns: ['src/ui/**'] }],
      shared: ['package.json'],
    }));
    git('add', '-A');
    git('commit', '-q', '-m', 'init');
  });
  afterEach(async () => { await rm(dir, { recursive: true, force: true, maxRetries: 5 }); });

  it('passes good commits and reports untagged ones without failing', async () => {
    await commit('src/api/a.ts', 'api: a\n\nLane: api');
    await commit('package.json', 'deps\n\nLane: ui');
    await commit('src/ui/b.ts', 'ui: b\n\nLane: control');
    const result = await runCheckLanes(dir);
    expect(result.problems).toEqual([]);
    expect(result.untagged).toHaveLength(1);
    expect(formatLaneCheck(result)).toMatch(/stayed in their lane/);
  });

  it('fails with a fix-it message for a commit that crosses lanes, honouring --range', async () => {
    await commit('src/api/a.ts', 'ok\n\nLane: api');
    const base = git('rev-parse', 'HEAD').trim();
    await commit('src/ui/x.ts', 'oops\n\nLane: api');
    const result = await runCheckLanes(dir, `${base}..HEAD`);
    expect(result.checked).toBe(1);
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]).toMatch(/lane "api" touched src\/ui\/x.ts.*belongs to lane "ui".*outbox/);
    expect((await runCheckLanes(dir, `${base}~1..${base}`)).problems).toEqual([]);
  });

  it('exits non-zero from the CLI on a violation and zero otherwise', async () => {
    await commit('src/ui/x.ts', 'oops\n\nLane: api');
    let code = 0;
    try { execFileSync(process.execPath, [tsx, cli, 'check-lanes', dir], { encoding: 'utf8', stdio: 'pipe' }); } catch (e) { code = (e as { status: number }).status; }
    expect(code).toBe(1);
    expect(execFileSync(process.execPath, [tsx, cli, 'check-lanes', dir, '--range', 'HEAD..HEAD'], { encoding: 'utf8' })).toMatch(/Checked 0/);
  });

  it('ignores merge commits, reads non-ASCII paths, and skips a shallow clone\'s oldest commit', async () => {
    git('checkout', '-q', '-b', 'side');
    await commit('src/ui/é ü.ts', 'ui\n\nLane: ui');
    git('checkout', '-q', 'main');
    await commit('src/api/a.ts', 'api\n\nLane: api');
    git('merge', '--no-ff', '-q', '-m', 'merge side\n\nLane: api', 'side');
    expect((await runCheckLanes(dir)).problems).toEqual([]);
    const clone = path.join(dir, '..', `${path.basename(dir)}-shallow`);
    execFileSync('git', ['clone', '-q', '--depth', '1', `file://${dir}`, clone]);
    try {
      const result = await runCheckLanes(clone);
      expect(result.problems).toEqual([]);
      expect(result.skipped).toHaveLength(1);
    } finally { await rm(clone, { recursive: true, force: true, maxRetries: 5 }); }
  });

  it('warns on an empty range', async () => {
    expect(formatLaneCheck(await runCheckLanes(dir, 'HEAD..HEAD'))).toMatch(/Nothing to check/);
  });

  it('explains a missing or bad config and a bad range', async () => {
    await expect(runCheckLanes(dir, 'nope..HEAD')).rejects.toThrow(/Check the range/);
    await rm(path.join(dir, '.ai', 'lanes.json'));
    await expect(runCheckLanes(dir)).rejects.toThrow(/loop init --lanes/);
    await writeFile(path.join(dir, '.ai', 'lanes.json'), '{"lanes":[]}');
    await expect(runCheckLanes(dir)).rejects.toThrow(/invalid/);
  });
});
