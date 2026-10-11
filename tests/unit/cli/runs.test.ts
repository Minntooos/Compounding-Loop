import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formatRuns, logRun, readRuns } from '../../../src/cli/runs.js';
import { expectedSlots, formatRunEntry, matchSlots, missedInARow, parseRunLog } from '../../../src/core/parse/runs.js';

const d = (s: string) => new Date(s);

describe('expectedSlots', () => {
  it('lists an hourly minute inside (from, to]', () => {
    const slots = expectedSlots('7 * * * *', d('2026-10-11T10:07:00Z'), d('2026-10-11T13:07:00Z'));
    expect(slots.map((s) => s.toISOString())).toEqual(['2026-10-11T11:07:00.000Z', '2026-10-11T12:07:00.000Z', '2026-10-11T13:07:00.000Z']);
  });
  it('reads lists, ranges, steps and weekdays (7 is Sunday)', () => {
    expect(expectedSlots('*/20 9 * * *', d('2026-10-11T08:59:00Z'), d('2026-10-11T10:00:00Z')).map((s) => s.getUTCMinutes())).toEqual([0, 20, 40]);
    expect(expectedSlots('0 9-10 * * *', d('2026-10-11T00:00:00Z'), d('2026-10-11T23:00:00Z')).map((s) => s.getUTCHours())).toEqual([9, 10]);
    expect(expectedSlots('0,30 12 * * 7', d('2026-10-10T00:00:00Z'), d('2026-10-12T00:00:00Z')).map((s) => s.toISOString())).toEqual(['2026-10-11T12:00:00.000Z', '2026-10-11T12:30:00.000Z']);
    expect(expectedSlots('0 12 * * 1', d('2026-10-11T00:00:00Z'), d('2026-10-12T00:00:00Z'))).toEqual([]);
  });
  it('is empty for unreadable expressions', () => {
    for (const bad of ['', '* * *', '61 * * * *', 'x * * * *', '*/0 * * * *', '5-2 * * * *']) expect(expectedSlots(bad, d('2026-10-11T00:00:00Z'), d('2026-10-11T05:00:00Z'))).toEqual([]);
  });
});

describe('run log parsing', () => {
  const entry = { at: '2026-10-11T10:30:00.000Z', lane: 'api', units: ['audit'], tests: { passed: 10, failed: 0 }, pushed: true, note: 'ok' };
  it('round-trips and skips bad lines, sorted oldest first', () => {
    const later = { ...entry, at: '2026-10-11T12:00:00.000Z', units: [] as string[], pushed: false };
    const text = `${formatRunEntry(later)}garbage\n{"at":"nope","lane":"x","pushed":true}\n\n${formatRunEntry(entry)}`;
    expect(parseRunLog(text)).toEqual([entry, later]);
  });
  it('drops bad optional fields instead of the whole line', () => {
    const [e] = parseRunLog('{"at":"2026-10-11T10:00:00Z","lane":"a","pushed":false,"tests":{"passed":-1,"failed":0},"units":[1,"u"]}');
    expect(e).toEqual({ at: '2026-10-11T10:00:00Z', lane: 'a', units: ['u'], pushed: false });
  });
});

describe('matchSlots', () => {
  const slots = [d('2026-10-11T10:07:00Z'), d('2026-10-11T11:07:00Z'), d('2026-10-11T12:07:00Z'), d('2026-10-11T13:07:00Z')];
  const run = (at: string, extra: object = {}) => ({ at, lane: 'api', units: [], pushed: true, ...extra });
  it('assigns each run to the latest slot before its end and classifies outcomes', () => {
    const r = matchSlots(slots, [run('2026-10-11T10:50:00Z'), run('2026-10-11T11:30:00Z', { pushed: false }), run('2026-10-11T12:40:00Z', { tests: { passed: 1, failed: 2 } })]);
    expect(r.map((x) => x.outcome)).toEqual(['pushed', 'nothing-pushed', 'tests-failed', 'no-run-recorded']);
  });
  it('credits a long run to its own slot when it ends after the next slot began', () => {
    const r = matchSlots(slots, [run('2026-10-11T11:20:00Z'), run('2026-10-11T11:50:00Z')]);
    expect(r.map((x) => x.outcome)).toEqual(['pushed', 'pushed', 'no-run-recorded', 'no-run-recorded']);
  });
  it('counts a commit in a slot as a run without a log line', () => {
    expect(matchSlots(slots, [], [d('2026-10-11T11:20:00Z')]).map((x) => x.outcome)).toEqual(['no-run-recorded', 'pushed', 'no-run-recorded', 'no-run-recorded']);
  });
  it('counts trailing misses', () => {
    expect(missedInARow(matchSlots(slots, [run('2026-10-11T10:50:00Z')]))).toBe(3);
    expect(missedInARow([])).toBe(0);
  });
});

describe('loop runs', () => {
  let dir: string;
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  const now = d('2026-10-11T13:30:00Z');
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'loop-runs-'));
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 't@example.com');
    git('config', 'user.name', 'Tess');
    git('config', 'commit.gpgsign', 'false');
    await mkdir(path.join(dir, '.ai'));
    await writeFile(path.join(dir, '.ai', 'lanes.json'), JSON.stringify({ lanes: [{ name: 'api', owns: ['src/**'], cron: '7 * * * *' }, { name: 'ui', owns: ['ui/**'] }] }));
    git('add', '-A');
    git('commit', '-qm', 'init\n\nLane: control');
  });
  afterEach(() => rm(dir, { recursive: true, force: true, maxRetries: 5 }));

  it('log appends valid lines to the lane\'s own file', async () => {
    await logRun(dir, 'api', { units: ['a', 'b'], passed: 12, failed: 0, pushed: true, note: ' two\nlines ', now });
    await logRun(dir, 'api', { pushed: false, now });
    const lines = (await readFile(path.join(dir, '.ai/lanes/api/runs.jsonl'), 'utf8')).trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0] as string)).toEqual({ at: now.toISOString(), lane: 'api', units: ['a', 'b'], tests: { passed: 12, failed: 0 }, pushed: true, note: 'two lines' });
    expect(JSON.parse(lines[1] as string)).toEqual({ at: now.toISOString(), lane: 'api', units: [], pushed: false });
  });

  it('log rejects unknown lanes and half or negative test counts', async () => {
    await expect(logRun(dir, 'nope', { pushed: true })).rejects.toThrow(/Lanes here: api, ui/);
    await expect(logRun(dir, 'api', { pushed: true, passed: 1 })).rejects.toThrow(/together/);
    await expect(logRun(dir, 'api', { pushed: true, passed: -1, failed: 0 })).rejects.toThrow(/whole numbers/);
  });

  it('lists logged runs and missing slots; three misses in a row are flagged', async () => {
    await logRun(dir, 'api', { pushed: true, units: ['x'], now: d('2026-10-11T10:50:00Z') });
    const report = await readRuns(dir, { now, hours: 4 });
    const api = report.lanes.find((l) => l.lane === 'api');
    expect(api?.slots.map((s) => s.outcome)).toEqual(['pushed', 'no-run-recorded', 'no-run-recorded', 'no-run-recorded']);
    expect(api?.missedInARow).toBe(3);
    expect(report.lanes.find((l) => l.lane === 'ui')).toMatchObject({ slots: [], entries: [], missedInARow: 0 });
    const text = formatRuns(report);
    expect(text).toContain('no run recorded (usage limit, idle or failed)');
    expect(text).toContain("check your plan's usage limit");
  });

  it('a Lane: trailer commit stands in for a missing log line', async () => {
    await writeFile(path.join(dir, 'a.txt'), 'x');
    git('add', '-A');
    git('commit', '-qm', 'api work\n\nLane: api', '--date', '2026-10-11T11:20:00Z');
    const report = await readRuns(dir, { now: new Date(), hours: 24 * 365 * 5 });
    expect(report.lanes[0]?.slots.length).toBeGreaterThan(0);
  });

  it('is wired into the CLI with --json', () => {
    const run = (...args: string[]) => execFileSync(process.execPath, [path.resolve('node_modules/tsx/dist/cli.mjs'), path.resolve('src/cli/index.ts'), ...args, '--dir', dir], { encoding: 'utf8' });
    expect(run('runs', 'log', '--lane', 'ui', '--no-pushed', '--units', 'u1', 'u2', '--passed', '3', '--failed', '1', '--note', 'hi')).toMatch(/Logged ui run/);
    const json = JSON.parse(run('runs', '--json', '--hours', '1')) as { lanes: { lane: string; entries: { units: string[]; pushed: boolean; tests: object }[] }[] };
    expect(json.lanes.find((l) => l.lane === 'ui')?.entries[0]).toMatchObject({ units: ['u1', 'u2'], pushed: false, tests: { passed: 3, failed: 1 } });
  });
});
