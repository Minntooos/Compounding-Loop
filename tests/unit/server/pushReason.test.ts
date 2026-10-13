import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { pushWithReason } from '../../../src/server/loops.js';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true, maxRetries: 5 });
});

const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, stdio: 'pipe' });

function repo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'push-reason-'));
  dirs.push(dir);
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, '-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '--allow-empty', '-m', 'x');
  return dir;
}

describe('pushWithReason', () => {
  it('names why the push failed when the clone has no remote', async () => {
    const result = await pushWithReason(repo());
    expect(result.pushed).toBe(false);
    expect(result.pushError).toBeTruthy();
    expect(result.pushError).not.toMatch(/\n/);
  });

  it('reports a successful push without an error', async () => {
    const dir = repo();
    const remote = mkdtempSync(path.join(tmpdir(), 'push-remote-'));
    dirs.push(remote);
    git(remote, 'init', '-q', '--bare');
    git(dir, 'remote', 'add', 'origin', remote);
    git(dir, 'push', '-q', '-u', 'origin', 'main');
    expect(await pushWithReason(dir)).toEqual({ pushed: true });
  });
});
