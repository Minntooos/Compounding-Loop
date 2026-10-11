import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formatShipCheck, runShipCheck } from '../../../src/cli/shipCheck.js';

describe('loop ship-check', () => {
  let dir: string;
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  const cli = (...args: string[]) => execFileSync(process.execPath, [path.resolve('node_modules/tsx/dist/cli.mjs'), path.resolve('src/cli/index.ts'), 'ship-check', dir, ...args], { encoding: 'utf8' });

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'loop-ship-'));
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 't@example.com');
    git('config', 'user.name', 'Tess');
    git('config', 'commit.gpgsign', 'false');
    await mkdir(path.join(dir, '.ai', 'lanes', 'api'), { recursive: true });
    await writeFile(path.join(dir, 'package.json'), JSON.stringify({ name: 'x', version: '0.4.0' }));
    await writeFile(path.join(dir, '.ai', 'lanes.json'), JSON.stringify({ lanes: [{ name: 'api', owns: ['src/**'] }] }));
    await writeFile(path.join(dir, 'CHANGELOG.md'), '## [0.4.0] - 2026-10-14\n- Thing\n');
    await writeFile(path.join(dir, 'DONE.md'), '# Done\n## Minor findings left open\n- none\n');
    await writeFile(path.join(dir, '.ai', 'lanes', 'api', 'runs.jsonl'), '{"at":"2026-10-14T10:00:00Z","lane":"api","units":[],"tests":{"passed":9,"failed":0},"pushed":true}\n');
    git('add', '-A');
    git('commit', '-qm', 'init\n\nLane: control');
  });
  afterEach(() => rm(dir, { recursive: true, force: true, maxRetries: 5 }));

  it('is ready with the facts on disk, reading tests from the run log', async () => {
    const r = await runShipCheck(dir);
    expect(r.ready).toBe(true);
    expect(r.items.find((i) => i.id === 'tests')?.detail).toContain('9 passed');
    expect(formatShipCheck(r)).toMatch(/Ready to ship\.$/);
  });

  it('notices an existing tag and a dirty tree, and falls back to last-test.json', async () => {
    git('tag', 'v0.4.0');
    await writeFile(path.join(dir, 'stray.txt'), 'x');
    await rm(path.join(dir, '.ai', 'lanes', 'api', 'runs.jsonl'));
    await writeFile(path.join(dir, '.ai', 'last-test.json'), '{"passed":3,"failed":2}');
    const r = await runShipCheck(dir);
    expect(r.items.filter((i) => !i.ok).map((i) => i.id)).toEqual(['tag', 'clean', 'tests']);
    expect(formatShipCheck(r)).toMatch(/✗ Tests pass: 2 failing.*\n.*\nNot ready to ship\.$/s);
  });

  it('needs a package.json version', async () => {
    await rm(path.join(dir, 'package.json'));
    await expect(runShipCheck(dir)).rejects.toThrow(/version/);
  });

  it('CLI: --json shape and exit code', async () => {
    expect((JSON.parse(cli('--json')) as { ready: boolean }).ready).toBe(true);
    await writeFile(path.join(dir, 'stray.txt'), 'x');
    let code = 0;
    try {
      cli();
    } catch (error) {
      code = (error as { status: number }).status;
    }
    expect(code).toBe(1);
  });
});
