import { readFileSync, readdirSync } from 'node:fs';
const read = readFileSync;
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildLiveLoop, commitsSinceUrl, countRoundFiles, hasMoreCommits, mergeCommits, snapshotSince, isRepoSlug, laneFilePaths, latestFinishedRun, liveUrls, mapCommits, mapRuns, rawUrl } from '../../../src/server/live/index.js';

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
    expect(JSON.stringify(commits)).not.toMatch(/@/);
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
    expect(detail).toMatchObject({ id: 'Compounding-Loop', round: 2, run: 5, runLimit: 40, url: 'https://github.com/Minntooos/Compounding-Loop', decisions: ['chose x'] });
    expect(detail.contract).toEqual([{ text: 'tests pass', pass: false }]);
    expect(detail.lastCommit?.sha).toBe('b3c1d2e');
    expect(detail.timeline).toHaveLength(3);
    const [core, server] = detail.lanes ?? [];
    expect(core).toMatchObject({ name: 'core', run: 4, limit: 20, lastCommit: { sha: 'b3c1d2e' } });
    expect(server?.claim).toEqual({ name: 'Ada', expiresAt: '2026-10-11T09:00:00.000Z' });
    expect(server?.unanswered.map((m) => m.from)).toEqual(['core']);
    expect(core?.waitingOn).toEqual(['server']);
    // The server lane is stalled but claimed by Ada, so it is not reported as silent.
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
    const files = [...dirs.flatMap((d) => readdirSync(d).map((f) => path.join(d, f))), path.join(here, '../../../src/server/laneChecks.ts'), path.join(here, '../../../src/server/taskBullets.ts'), path.join(here, '../../../src/server/checkLabels.ts'), path.join(here, '../../../src/server/roundState.ts')];
    for (const file of files) expect(read(file, 'utf8'), file).not.toMatch(/from 'node:|require\(/);
  });
});

describe('buildLiveLoop id', () => {
  it('uses the id from live.json when given', () => {
    expect(buildLiveLoop({ slug: 'a/b', id: 'compounding-loop', commits: [], runs: {}, files: {}, now: NOW }).detail.id).toBe('compounding-loop');
  });
});

describe('commit history beyond one page (regression: the timeline stopped at 100 commits)', () => {
  const commit = (n: number, extra: object = {}) => ({ sha: `c${String(n).padStart(6, '0')}`, at: new Date(Date.UTC(2026, 9, 1, 0, n)).toISOString(), message: `commit ${n}`, ...extra });

  it('builds the paged `since` URL from the snapshot head', () => {
    expect(commitsSinceUrl('a/b', '2026-10-11T14:51:27Z', 2)).toBe('https://api.github.com/repos/a/b/commits?sha=main&since=2026-10-11T14%3A51%3A27.000Z&per_page=100&page=2');
    expect(() => commitsSinceUrl('../x', '2026-10-11T00:00:00Z')).toThrow(/slug/);
    expect(() => commitsSinceUrl('a/b', 'yesterday')).toThrow(/date/);
    expect(hasMoreCommits(100)).toBe(true);
    expect(hasMoreCommits(99)).toBe(false);
  });

  it('takes `since` from the newest snapshot commit', () => {
    expect(snapshotSince([commit(1), commit(5), commit(3)])).toBe(commit(5).at);
    expect(snapshotSince([])).toBeUndefined();
  });

  it('merges 150 snapshot commits with 120 live ones (30 shared) into 240 unique, newest first', () => {
    const snapshot = Array.from({ length: 150 }, (_, i) => commit(i));
    const live = Array.from({ length: 120 }, (_, i) => commit(i + 120));
    const merged = mergeCommits(snapshot, live);
    expect(merged).toHaveLength(240);
    expect(new Set(merged.map((c) => c.sha)).size).toBe(240);
    expect(merged[0]?.message).toBe('commit 239');
    expect(merged.at(-1)?.message).toBe('commit 0');
  });

  it('keeps the live copy of a shared commit, with its author and lane', () => {
    const merged = mergeCommits([commit(1)], [{ ...commit(1), message: 'live copy', author: 'Ada', lane: 'core' }]);
    expect(merged).toEqual([{ ...commit(1), message: 'live copy', author: 'Ada', lane: 'core' }]);
  });

  it('buildLiveLoop shows the snapshot history under the live commits', () => {
    const snapshotCommits = Array.from({ length: 130 }, (_, i) => commit(i));
    const live = buildLiveLoop({ slug: 'o/n', commits: fixture('commits.json'), runs: fixture('runs.json'), files: {}, now: NOW, snapshotCommits });
    expect(live.detail.timeline).toHaveLength(133);
    expect(live.detail.timeline[0]?.sha).toBe('b3c1d2e');
    expect(live.detail.timeline.at(-1)?.sha).toBe(commit(0).sha);
  });
});

describe('commit authors', () => {
  const entry = (name: unknown) => [{ sha: 'abcdef012', commit: { message: 'x', committer: { date: '2026-10-11T01:00:00Z' }, author: { name, email: 'a@b.co' } } }];
  it('reads the display name and never an email', () => {
    expect(mapCommits(entry('Ada Lovelace'))[0]?.author).toBe('Ada Lovelace');
    expect(mapCommits(entry('ada@example.com'))[0]?.author).toBeUndefined();
    expect(mapCommits(entry(42))[0]?.author).toBeUndefined();
    expect(JSON.stringify(mapCommits(entry('Ada')))).not.toContain('a@b.co');
  });
});

describe('a finished round waits for the owner (regression: "Nothing needs you" while DONE.md waited)', () => {
  const files = { '.ai/lanes.json': lanesJson, 'DONE.md': '# Done\n', 'package.json': '{"name":"x","version":"0.4.0"}', '.ai/done-v1.md': 'r', '.ai/done-v2.md': 'r', '.ai/done-v3.md': 'r', '.ai/lanes/core/task.md': 'Run: 4 / 20', '.ai/lanes/server/task.md': 'Run: 6 / 20' };
  const base = { slug: 'Minntooos/Compounding-Loop', commits: fixture('commits.json'), runs: {}, now: NOW, pagesUrl: 'https://minntooos.github.io/Compounding-Loop/' };

  it('puts a release item in the attention list and says so in the state', () => {
    const { detail, inbox } = buildLiveLoop({ ...base, files });
    expect(detail).toMatchObject({ state: 'done', roundLabel: 'Round 4 done · 0.4.0', releaseWaiting: true, reason: 'Round 4 done · 0.4.0 · release waiting on you' });
    expect(inbox).toEqual([{ loopId: 'Compounding-Loop', file: 'DONE.md', kind: 'release', question: 'Release 0.4.0 is waiting on you', bestGuess: 'Check "Ready to ship", then run the Release workflow', since: '2026-10-11T05:35:00.000Z' }]);
  });

  it('a loop without lanes that finished is just finished', () => {
    const { detail, inbox } = buildLiveLoop({ ...base, files: { 'DONE.md': 'x' } });
    expect(detail.releaseWaiting).toBeUndefined();
    expect(inbox).toEqual([]);
  });

  it('no DONE.md: no release item, plain round label', () => {
    const { detail, inbox } = buildLiveLoop({ ...base, files: { ...files, 'DONE.md': undefined } });
    expect([detail.roundLabel, detail.releaseWaiting, inbox.filter((i) => i.kind !== 'lanes-not-running')]).toEqual(['Round 4', undefined, []]);
  });

  it('settings: the budget is the lanes\' budgets and the site is the Pages URL, not the repo (regression: "Run limit 0")', () => {
    const { detail } = buildLiveLoop({ ...base, files });
    expect([detail.run, detail.runLimit]).toEqual([10, 40]);
    expect([detail.url, detail.demoUrl, detail.repoUrl]).toEqual(['https://minntooos.github.io/Compounding-Loop/', 'https://minntooos.github.io/Compounding-Loop/', 'https://github.com/Minntooos/Compounding-Loop']);
    expect(buildLiveLoop({ ...base, pagesUrl: undefined, files }).detail.url).toBe('https://github.com/Minntooos/Compounding-Loop');
  });
});

describe('commit lanes and per-lane notes', () => {
  const taskCore = '# Lane: core\n\n**Done when:** `npm test` passes; audit has no open blocker.\n\n## Decisions\n- chose x\n\n## Confirmed\n- y works\n';
  it('gives every commit a lane: trailer, then prefix, release subjects, else other (regression: release read "other")', () => {
    const entry = (sha: string, message: string) => ({ sha: `${sha}00000`, commit: { message, committer: { date: '2026-10-11T05:35:00Z' } } });
    const commits = [entry('a', 'Release 0.3.0: version bump'), entry('b', 'core: x'), entry('c', 'tweak\n\nLane: web'), entry('d', 'random subject'), entry('e', 'control room: note')];
    const { detail } = buildLiveLoop({ slug: 'o/n', commits, runs: {}, files: { '.ai/lanes.json': lanesJson }, now: NOW });
    expect(detail.timeline.map((c) => c.lane).sort()).toEqual(['control', 'core', 'other', 'release', 'web']);
  });
  it('groups each lane\'s contract, decisions and knowledge (regression: Contract blank, Decisions "none")', () => {
    const { detail } = buildLiveLoop({ slug: 'o/n', commits: [], runs: {}, now: NOW, files: { '.ai/lanes.json': lanesJson, '.ai/lanes/core/task.md': taskCore, '.ai/lanes/core/DONE.md': 'x' } });
    expect(detail.laneNotes).toEqual([
      { lane: 'core', contract: [{ text: '`npm test` passes', pass: true }, { text: 'audit has no open blocker', pass: true }], decisions: ['chose x'], knowledge: ['y works'] },
      { lane: 'server', contract: [], decisions: [], knowledge: [] },
    ]);
  });
  it('has no laneNotes without lanes', () => {
    expect(buildLiveLoop({ slug: 'o/n', commits: [], runs: {}, files: {}, now: NOW }).detail.laneNotes).toBeUndefined();
  });
});
