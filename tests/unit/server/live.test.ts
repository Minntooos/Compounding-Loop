import { readFileSync, readdirSync } from 'node:fs';
const read = readFileSync;
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildLiveLoop, countRoundFiles, isRepoSlug, laneFilePaths, latestFinishedRun, liveUrls, mapCommits, mapRuns, rawUrl } from '../../../src/server/live/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string): unknown => JSON.parse(readFileSync(path.join(here, 'fixtures', 'live', name), 'utf8'));
const NOW = new Date('2026-10-11T07:00:00Z');
const lanesJson = JSON.stringify({ lanes: [{ name: 'core', owns: ['src/core/**'], cron: '0 * * * *' }, { name: 'server', owns: ['src/server/**'], cron: '0 * * * *' }], shared: [] });

describe('urls', () => {
  it('lists the API and raw URLs for a slug', () => {
    const urls = liveUrls('Minntooos/Compounding-Loop');
    expect(urls.commits).toBe('https://api.github.com/repos/Minntooos/Compounding-Loop/commits?sha=main&per_page=100');
    expect(urls.runs).toContain('/actions/runs?branch=main');
    expect(urls.files['.ai/task.md']).toBe('https://raw.githubusercontent.com/Minntooos/Compounding-Loop/main/.ai/task.md');
    for (const url of [urls.commits, urls.runs, ...Object.values(urls.files)]) expect(url).toMatch(/^https:\/\/(api\.github\.com|raw\.githubusercontent\.com)\//);
  });
  it('rejects slugs that could escape the repo path', () => {
    for (const bad of ['', 'a', 'a/b/c', '../x', 'a/..', 'a b/c', 'a/b?x=1', 'a/b#c']) expect(isRepoSlug(bad)).toBe(false);
    expect(() => liveUrls('../etc/passwd')).toThrow(/slug/);
  });
  it('builds per-lane file paths and a raw url', () => {
    expect(laneFilePaths(['core'])).toContain('.ai/lanes/core/outbox.md');
    expect(rawUrl('a/b', 'x.md', 'dev')).toBe('https://raw.githubusercontent.com/a/b/dev/x.md');
  });
  it('counts done-vN files', () => {
    expect(countRoundFiles({ '.ai/done-v1.md': 'x', '.ai/done-v2.md': 'y', '.ai/done-v3.md': undefined })).toBe(2);
  });
});

describe('mappers', () => {
  it('maps commits, keeps the lane trailer and skips malformed entries', () => {
    const commits = mapCommits(fixture('commits.json'));
    expect(commits.map((c) => [c.sha, c.message, c.lane])).toEqual([
      ['b3c1d2e', 'core: loop next', 'core'],
      ['a1b2c3d', 'server: live mappers', 'server'],
      ['9f8e7d6', 'docs: readme', undefined],
    ]);
    expect(commits[0]?.at).toBe('2026-10-11T05:35:00.000Z');
    expect(JSON.stringify(commits)).not.toMatch(/someone|@/);
  });
  it('falls back to the author date when the committer is null', () => {
    expect(mapCommits([{ sha: 'abcdef012', commit: { message: 'x', committer: null, author: { date: '2026-10-11T01:00:00Z' } } }])[0]?.at).toBe('2026-10-11T01:00:00.000Z');
  });
  it('returns nothing for wrong shapes', () => {
    expect(mapCommits({})).toEqual([]);
    expect(mapRuns([])).toEqual([]);
    expect(mapRuns({ workflow_runs: 'x' })).toEqual([]);
  });
  it('maps runs and finds the newest finished one', () => {
    const runs = mapRuns(fixture('runs.json'));
    expect(runs).toHaveLength(3);
    expect(latestFinishedRun(runs)).toMatchObject({ conclusion: 'success', at: '2026-10-11T05:41:00.000Z' });
    expect(latestFinishedRun([])).toBeUndefined();
  });
});

describe('buildLiveLoop', () => {
  const base = { slug: 'Minntooos/Compounding-Loop', commits: fixture('commits.json'), runs: fixture('runs.json'), now: NOW };
  it('builds a laned loop from files, commits and runs', () => {
    const { detail, inbox, checks } = buildLiveLoop({
      ...base,
      files: {
        '.ai/task.md': 'Run: 3 / 20\n\n## Done when\n- tests pass\n\n## Decisions\n- chose x\n',
        '.ai/lanes.json': lanesJson,
        '.ai/done-v1.md': 'r1',
        '.ai/lanes/core/task.md': 'Run: 4 / 20',
        '.ai/lanes/core/outbox.md': '2026-10-11 05:00 UTC · to server · please add x\n',
        '.ai/lanes/server/task.md': 'Run: 1 / 20',
        '.ai/lanes/server/claim': 'Ada · expires 2026-10-11T09:00:00.000Z',
      },
    });
    expect(detail).toMatchObject({ id: 'Compounding-Loop', round: 2, run: 3, runLimit: 20, url: 'https://github.com/Minntooos/Compounding-Loop', decisions: ['chose x'] });
    expect(detail.contract).toEqual([{ text: 'tests pass', pass: false }]);
    expect(detail.lastCommit?.sha).toBe('b3c1d2e');
    expect(detail.timeline).toHaveLength(3);
    const [core, server] = detail.lanes ?? [];
    expect(core).toMatchObject({ name: 'core', run: 4, limit: 20, lastCommit: { sha: 'b3c1d2e' } });
    expect(server?.claim).toEqual({ name: 'Ada', expiresAt: '2026-10-11T09:00:00.000Z' });
    expect(server?.unanswered.map((m) => m.from)).toEqual(['core']);
    expect(core?.waitingOn).toEqual(['server']);
    expect(inbox).toEqual([]);
    expect(checks.map((c) => [c.kind, c.ok])).toEqual([['failing-tests', true], ['lane-stalled', false], ['lane-waiting-on-finished', true]]);
    expect([core?.state, server?.state]).toEqual(['waiting', 'stalled']);
  });
  it('turns a lane with no recent commit into stalled and fails the loop', () => {
    const { detail, checks } = buildLiveLoop({ ...base, now: new Date('2026-10-12T07:00:00Z'), files: { '.ai/lanes.json': lanesJson } });
    expect(detail.lanes?.every((l) => l.state === 'stalled' || l.lastCommit === undefined)).toBe(true);
    expect(detail.lanes?.find((l) => l.name === 'core')?.state).toBe('stalled');
    expect(detail.state).toBe('failing');
    expect(checks.find((c) => c.kind === 'lane-stalled')?.ok).toBe(false);
  });
  it('fails the loop when the latest finished run failed', () => {
    const runs = { workflow_runs: [{ name: 'CI', status: 'completed', conclusion: 'failure', updated_at: '2026-10-11T06:30:00Z' }] };
    const { detail, checks } = buildLiveLoop({ ...base, runs, files: {} });
    expect(checks).toHaveLength(1);
    expect(detail.state).toBe('failing');
    expect(detail.reason).toContain('failure');
  });
  it('reads BLOCKED.md into the inbox and DONE.md into done', () => {
    const blocked = buildLiveLoop({ ...base, runs: {}, files: { 'BLOCKED.md': '## Question\nWhich db?\n\n## Best guess\nsqlite\n' } });
    expect(blocked.detail.state).toBe('blocked');
    expect(blocked.inbox).toEqual([{ loopId: 'Compounding-Loop', file: 'BLOCKED.md', question: 'Which db?', bestGuess: 'sqlite', since: '2026-10-11T05:35:00.000Z' }]);
    expect(buildLiveLoop({ ...base, runs: {}, files: { 'DONE.md': 'x' } }).detail.state).toBe('done');
  });
  it('copes with empty data', () => {
    const { detail, inbox, checks } = buildLiveLoop({ slug: 'a/b', commits: null, runs: null, files: {}, now: NOW });
    expect(detail).toMatchObject({ id: 'b', state: 'waiting', timeline: [], run: 0 });
    expect(detail.lanes).toBeUndefined();
    expect([inbox, checks]).toEqual([[], []]);
  });
});

describe('browser safety', () => {
  it('src/server/live and the files it imports from src/server use no node: modules', () => {
    const dirs = [path.join(here, '../../../src/server/live')];
    const files = [...dirs.flatMap((d) => readdirSync(d).map((f) => path.join(d, f))), path.join(here, '../../../src/server/laneChecks.ts'), path.join(here, '../../../src/server/taskBullets.ts')];
    for (const file of files) expect(read(file, 'utf8'), file).not.toMatch(/from 'node:|require\(/);
  });
});

describe('buildLiveLoop id', () => {
  it('uses the id from live.json when given', () => {
    expect(buildLiveLoop({ slug: 'a/b', id: 'compounding-loop', commits: [], runs: {}, files: {}, now: NOW }).detail.id).toBe('compounding-loop');
  });
});
