import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readLaneStatuses } from '../../../src/cli/laneStatus.js';
import { runStatus } from '../../../src/cli/loops.js';

describe('lane status', () => {
  let dir: string;
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  const put = async (rel: string, text: string) => { await mkdir(path.dirname(path.join(dir, rel)), { recursive: true }); await writeFile(path.join(dir, rel), text); };

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'loop-lstatus-'));
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 't@example.com');
    git('config', 'user.name', 'T');
    git('config', 'commit.gpgsign', 'false');
    await put('.ai/lanes.json', JSON.stringify({ lanes: [{ name: 'api', owns: ['api/**'] }, { name: 'ui', owns: ['ui/**'] }], shared: [] }));
    await put('.ai/lanes/api/task.md', 'Run: 4 / 20\n');
    await put('.ai/lanes/api/outbox.md', '2026-10-08 05:00 UTC · to ui · endpoint is live\n');
    await put('.ai/lanes/ui/outbox.md', '2026-10-08 04:00 UTC · to api · need an endpoint\n');
    await put('api/a.ts', 'x');
    git('add', '-A');
    git('commit', '-q', '-m', 'api: first\n\nLane: api');
  });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  it('is undefined for a folder without lanes.json', async () => {
    await rm(path.join(dir, '.ai', 'lanes.json'));
    expect(await readLaneStatuses(dir)).toBeUndefined();
  });

  it('reads run counter, last commit per lane, lock, stop files and unanswered messages', async () => {
    await put('.ai/lanes/ui/BLOCKED.md', 'q');
    await put('.ai/lanes/api/session.lock', new Date().toISOString());
    const [api, ui] = (await readLaneStatuses(dir))!;
    expect(api).toMatchObject({ name: 'api', state: 'building', run: 4, limit: 20, locked: true, lastCommit: { subject: 'api: first' } });
    expect(api?.unanswered).toEqual([]);
    expect(ui).toMatchObject({ name: 'ui', state: 'blocked', locked: false });
    expect(ui?.waitingOn).toBeUndefined();
    expect(ui?.lastCommit).toBeUndefined();
    expect(ui?.unanswered.map((m) => m.text)).toEqual(['endpoint is live']);
  });

  it('loop status prints a lane block under the fleet table', async () => {
    const out = await runStatus([dir]);
    expect(out).toMatch(/Lanes in loop-lstatus-/);
    expect(out).toMatch(/LANE\s+STATUS\s+RUN/);
    expect(out).toMatch(/api\s+. waiting\s+run 4\/20/);
  });
});
