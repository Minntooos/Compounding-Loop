import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { HealthCheck, LaneStatus, LoopDetail } from '../../../src/core/types.js';
import { createApp } from '../../../src/server/index.js';
import { laneChecks } from '../../../src/server/health.js';

const lane = (name: string, state: LaneStatus['state'], extra: Partial<LaneStatus> = {}): LaneStatus => ({ name, state, run: 1, limit: 20, locked: false, unanswered: [], ...extra });

describe('laneChecks', () => {
  it('passes when every lane is healthy', () => {
    const checks = laneChecks([lane('core', 'building'), lane('web', 'waiting')]);
    expect(checks.map((c) => [c.kind, c.ok])).toEqual([['lane-stalled', true], ['lane-waiting-on-finished', true]]);
  });

  it('flags a stalled lane by name', () => {
    const [stalled] = laneChecks([lane('core', 'building'), lane('docs', 'stalled')]);
    expect(stalled?.ok).toBe(false);
    expect(stalled?.reason).toContain('docs');
  });

  it('flags a lane that waits on a finished lane (round 1: web waited on server)', () => {
    const [, orphaned] = laneChecks([lane('server', 'done'), lane('web', 'waiting', { waitingOn: ['server'] })]);
    expect(orphaned?.ok).toBe(false);
    expect(orphaned?.reason).toBe('waiting on finished lane: web waits on server');
  });

  it('does not flag waiting on a lane that is still running, or a finished lane that waits', () => {
    expect(laneChecks([lane('server', 'building'), lane('web', 'waiting', { waitingOn: ['server'] })])[1]?.ok).toBe(true);
    expect(laneChecks([lane('server', 'done'), lane('web', 'done', { waitingOn: ['server'] })])[1]?.ok).toBe(true);
  });
});

describe('lanes over the API', () => {
  let root: string;
  const git = (dir: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], { cwd: dir, stdio: 'ignore' });

  beforeAll(() => {
    root = mkdtempSync(path.join(tmpdir(), 'cl-lanes-'));
    const dir = path.join(root, 'laned');
    mkdirSync(path.join(dir, '.ai', 'lanes', 'server'), { recursive: true });
    mkdirSync(path.join(dir, '.ai', 'lanes', 'web'), { recursive: true });
    writeFileSync(path.join(dir, '.ai', 'lanes.json'), JSON.stringify({ lanes: [{ name: 'server', owns: ['src/server/**'] }, { name: 'web', owns: ['web/**'] }] }));
    writeFileSync(path.join(dir, '.ai', 'lanes', 'server', 'task.md'), 'Run: 4 / 20\n');
    writeFileSync(path.join(dir, '.ai', 'lanes', 'server', 'DONE.md'), 'done\n');
    writeFileSync(path.join(dir, '.ai', 'lanes', 'web', 'task.md'), 'Run: 2 / 20\n');
    writeFileSync(path.join(dir, '.ai', 'lanes', 'web', 'outbox.md'), '2099-01-01 00:00 UTC · to server · please add lanes\n');
    writeFileSync(path.join(dir, '.ai', 'task.md'), 'Run: 1 / 5\n');
    mkdirSync(path.join(root, 'plain', '.ai'), { recursive: true });
    git(dir, 'init', '-q');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-qm', 'server: first\n\nLane: server');
  });
  afterAll(() => rmSync(root, { recursive: true, force: true, maxRetries: 5 }));

  it('returns lanes on the summary and detail of a laned loop only', async () => {
    const app = await createApp({ demo: false, projectsDir: root });
    const get = async <T>(url: string) => (await app.request(url, { headers: { host: 'localhost' } })).json() as Promise<T>;
    const detail = await get<LoopDetail>('/api/loops/laned');
    expect(detail.lanes?.map((l) => [l.name, l.state, l.run, l.limit])).toEqual([['server', 'done', 4, 20], ['web', 'waiting', 2, 20]]);
    expect(detail.lanes?.[0]?.lastCommit?.subject).toBe('server: first');
    expect(detail.lanes?.[0]?.unanswered).toEqual([expect.objectContaining({ from: 'web', to: 'server' })]);
    expect(detail.lanes?.[1]?.waitingOn).toEqual(['server']);
    const summaries = await get<{ id: string; lanes?: LaneStatus[] }[]>('/api/loops');
    expect(summaries.find((s) => s.id === 'laned')?.lanes).toHaveLength(2);
    expect(summaries.find((s) => s.id === 'plain')?.lanes).toBeUndefined();
  });

  it('turns a lane waiting on a finished lane into a failing loop with a proof on the Health page', async () => {
    const app = await createApp({ demo: false, projectsDir: root });
    const checks = (await (await app.request('/api/checks', { headers: { host: 'localhost' } })).json()) as HealthCheck[];
    const orphaned = checks.find((c) => c.loopId === 'laned' && c.kind === 'lane-waiting-on-finished');
    expect(orphaned?.ok).toBe(false);
    expect(checks.filter((c) => c.loopId === 'plain').map((c) => c.kind)).not.toContain('lane-stalled');
    const detail = (await (await app.request('/api/loops/laned', { headers: { host: 'localhost' } })).json()) as LoopDetail;
    expect(detail.state).toBe('failing');
  });
});
