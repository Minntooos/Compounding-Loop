import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EventBus, fingerprint, watchProjects, type LoopEvent } from '../../../src/server/events.js';
import { createApp, startServer } from '../../../src/server/index.js';

let root: string;
const git = (dir: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], { cwd: dir, stdio: 'ignore' });

function makeLoop(name: string): string {
  const dir = path.join(root, name);
  mkdirSync(path.join(dir, '.ai'), { recursive: true });
  writeFileSync(path.join(dir, '.ai', 'task.md'), 'Run: 1 / 30\n');
  git(dir, 'init', '-q');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'init');
  return dir;
}

const until = async (check: () => boolean, ms = 5000) => {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('timed out waiting for condition');
    await new Promise((r) => setTimeout(r, 20));
  }
};

beforeEach(() => { root = mkdtempSync(path.join(tmpdir(), 'cl-events-')); });
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('EventBus', () => {
  it('delivers to subscribers until they unsubscribe', () => {
    const bus = new EventBus();
    const got: LoopEvent[] = [];
    const off = bus.subscribe((e) => got.push(e));
    bus.emit({ type: 'inbox-changed' });
    off();
    bus.emit({ type: 'checks-changed' });
    expect(got).toEqual([{ type: 'inbox-changed' }]);
    expect(bus.size).toBe(0);
  });
});

describe('fingerprint', () => {
  it('changes when the upstream ref moves (after a fetch)', async () => {
    const dir = makeLoop('up');
    const remote = path.join(root, 'remote.git');
    execFileSync('git', ['clone', '-q', '--bare', dir, remote], { stdio: 'ignore' });
    git(dir, 'remote', 'add', 'origin', remote);
    git(dir, 'fetch', '-q', 'origin');
    const branch = execFileSync('git', ['branch', '--show-current'], { cwd: dir, encoding: 'utf8' }).trim();
    git(dir, 'branch', '-q', `--set-upstream-to=origin/${branch}`);
    const before = await fingerprint(dir);
    const other = path.join(root, 'other');
    execFileSync('git', ['clone', '-q', remote, other], { stdio: 'ignore' });
    writeFileSync(path.join(other, 'n.txt'), 'n');
    git(other, 'add', '-A');
    git(other, 'commit', '-qm', 'remote change');
    git(other, 'push', '-q');
    git(dir, 'fetch', '-q');
    expect(await fingerprint(dir)).not.toBe(before);
  });

  it('changes on a new commit and when BLOCKED.md appears', async () => {
    const dir = makeLoop('a');
    const before = await fingerprint(dir);
    expect(await fingerprint(dir)).toBe(before);
    writeFileSync(path.join(dir, 'BLOCKED.md'), 'q');
    const blocked = await fingerprint(dir);
    expect(blocked).not.toBe(before);
    git(dir, 'add', '-A');
    git(dir, 'commit', '-qm', 'more');
    expect(await fingerprint(dir)).not.toBe(blocked);
  });
});

describe('watchProjects', () => {
  it('emits loop-updated on a commit and inbox-changed when BLOCKED.md appears', async () => {
    const dir = makeLoop('a');
    const bus = new EventBus();
    const got: LoopEvent[] = [];
    bus.subscribe((e) => got.push(e));
    const stop = watchProjects(root, bus, { intervalMs: 30, fetchIntervalMs: 0 });
    try {
      await new Promise((r) => setTimeout(r, 400));
      expect(got).toEqual([]); // the first pass only records a baseline
      writeFileSync(path.join(dir, 'BLOCKED.md'), 'q');
      git(dir, 'add', '-A');
      git(dir, 'commit', '-qm', 'blocked');
      await until(() => got.some((e) => e.type === 'inbox-changed'));
      expect(got).toContainEqual({ type: 'loop-updated', id: 'a' });
    } finally {
      await stop();
    }
  });
});

describe('GET /api/events', () => {
  it('streams ready, then bus events as SSE', async () => {
    const bus = new EventBus();
    const app = await createApp({ demo: true, bus });
    const res = await app.request('/api/events');
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let text = '';
    const readUntil = async (needle: string) => {
      while (!text.includes(needle)) text += decoder.decode((await reader.read()).value);
    };
    await readUntil('event: ready');
    bus.emit({ type: 'loop-updated', id: 'proj1' });
    await readUntil('event: loop-updated');
    expect(text).toContain('data: {"id":"proj1"}');
    await reader.cancel();
    await until(() => bus.size === 0);
  });
});

describe('startServer watching a projects folder', () => {
  it('pushes loop-updated to a connected client when a clone changes', async () => {
    const dir = makeLoop('a');
    const server = await startServer({ demo: false, port: 0, projectsDir: root, watch: { intervalMs: 30, fetchIntervalMs: 0 } });
    try {
      const res = await fetch(`${server.url}/api/events`);
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let text = '';
      while (!text.includes('event: ready')) text += decoder.decode((await reader.read()).value);
      writeFileSync(path.join(dir, 'x.txt'), 'x');
      git(dir, 'add', '-A');
      git(dir, 'commit', '-qm', 'change');
      while (!text.includes('event: loop-updated')) text += decoder.decode((await reader.read()).value);
      expect(text).toContain('"id":"a"');
      await reader.cancel();
    } finally {
      await server.close();
    }
  });
});
