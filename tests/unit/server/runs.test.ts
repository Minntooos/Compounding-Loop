import { describe, expect, it } from 'vitest';
import type { LoopCommit } from '../../../src/core/types.js';
import { QUIET_KINDS, buildLiveLoop, buildRuns, lastRunOf, mapCommits, sessionKey, silentLanesItem } from '../../../src/server/live/index.js';

const NOW = new Date('2026-10-11T12:20:00Z');
const line = (o: object) => `${JSON.stringify(o)}\n`;
const commit = (sha: string, at: string, lane: string, session?: string): LoopCommit => ({ sha, at, message: `${lane}: ${sha}`, lane, ...(session && { session }) });

describe('buildRuns', () => {
  const lanes = [{ name: 'core', cron: '0 * * * *' }];

  it('maps each hourly slot to pushed / nothing pushed / tests failed / no run recorded, with its commits', () => {
    const logs = {
      core: line({ at: '2026-10-11T07:55:00Z', lane: 'core', units: [], pushed: false, note: 'stale clone' })
        + line({ at: '2026-10-11T08:30:00Z', lane: 'core', units: ['audit'], tests: { passed: 5, failed: 0 }, pushed: true })
        + line({ at: '2026-10-11T10:25:00Z', lane: 'core', units: ['x'], tests: { passed: 3, failed: 2 }, pushed: false }),
    };
    const commits = [commit('c1', '2026-10-11T08:20:00Z', 'core'), commit('s1', '2026-10-11T08:10:00Z', 'server')];
    const { runs } = buildRuns({ lanes, logs, commits, now: NOW });
    const byHour = Object.fromEntries(runs.filter((r) => r.at >= '2026-10-11T07').map((r) => [r.at.slice(11, 13), r.outcome]));
    // 11:00 started 80 minutes ago: still inside the grace period, so it is not listed as missing yet.
    expect(byHour).toEqual({ '07': 'nothing-pushed', '08': 'pushed', '09': 'no-run-recorded', '10': 'tests-failed' });
    const eight = runs.find((r) => r.at === '2026-10-11T08:00:00.000Z');
    expect(eight).toMatchObject({ lane: 'core', units: ['audit'], tests: { passed: 5, failed: 0 }, endedAt: '2026-10-11T08:30:00.000Z' });
    expect(eight?.commits.map((c) => c.sha)).toEqual(['c1']);
    expect(runs.find((r) => r.outcome === 'nothing-pushed')?.note).toBe('stale clone');
  });

  it('does not call a slot that may still be running "missing" (grace period), and gives the next slot', () => {
    const { runs, nextRuns } = buildRuns({ lanes, logs: {}, commits: [], now: NOW });
    expect(runs.some((r) => r.at === '2026-10-11T12:00:00.000Z')).toBe(false);
    expect(runs.some((r) => r.at === '2026-10-11T10:00:00.000Z')).toBe(true);
    expect(nextRuns).toEqual([{ lane: 'core', at: '2026-10-11T13:00:00.000Z' }]);
  });

  it('three missing runs in a row raise the lanes-not-running item; a run in between resets it', () => {
    const known = [commit('old', '2026-10-01T00:00:00Z', 'core')];
    const quiet = buildRuns({ lanes, logs: {}, commits: known, now: NOW });
    expect(quiet.silentLanes).toMatchObject([{ lane: 'core' }]);
    expect(quiet.silentLanes[0]?.missed).toBeGreaterThanOrEqual(3);
    expect(silentLanesItem('x', quiet.silentLanes, NOW.toISOString())).toMatchObject({ kind: 'lanes-not-running', question: expect.stringContaining("plan's usage limit") });
    const logs = { core: line({ at: '2026-10-11T10:30:00Z', lane: 'core', units: [], pushed: true }) };
    expect(buildRuns({ lanes, logs, commits: known, now: NOW }).silentLanes).toEqual([]);
    // New lanes (no log, no commit) and lanes stopped on purpose are not silent.
    expect(buildRuns({ lanes, logs: {}, commits: [], now: NOW }).silentLanes).toEqual([]);
    expect(buildRuns({ lanes: [{ name: 'core', cron: '0 * * * *', stopped: true }], logs: {}, commits: known, now: NOW }).silentLanes).toEqual([]);
    expect(silentLanesItem('x', [], NOW.toISOString())).toBeUndefined();
    // after 6 h of silence the usage-limit advice is dropped; the routines-look-off row takes over
    expect(silentLanesItem('x', quiet.silentLanes, NOW.toISOString(), true)).toBeUndefined();
  });

  it('a slot with a commit but no log line counts as run (the agent forgot the log step)', () => {
    const { runs } = buildRuns({ lanes, logs: {}, commits: [commit('c', '2026-10-11T10:40:00Z', 'core')], now: NOW });
    expect(runs.find((r) => r.at === '2026-10-11T10:00:00.000Z')?.outcome).toBe('pushed');
  });

  it('groups commits by session when both sides have one, even across the slot boundary', () => {
    const logs = { core: line({ at: '2026-10-11T10:50:00Z', lane: 'core', session: 'https://claude.ai/code/session_ABCDEFGH', units: [], pushed: true }) };
    const commits = [commit('late', '2026-10-11T11:05:00Z', 'core', 'ABCDEFGH'), commit('other', '2026-10-11T10:10:00Z', 'core', 'ZZZZZZZZ')];
    const run = buildRuns({ lanes, logs, commits, now: NOW }).runs.find((r) => r.at === '2026-10-11T10:00:00.000Z');
    // 'other' is inside the slot and its session is not logged, so it shows by time.
    expect(run?.commits.map((c) => c.sha)).toEqual(['late', 'other']);
  });

  it('a lane without cron lists only what it logged; the newest run is the fleet card line', () => {
    const logs = { web: line({ at: '2026-10-11T11:00:00Z', lane: 'web', units: ['u'], pushed: true }) };
    const data = buildRuns({ lanes: [{ name: 'web' }], logs, commits: [], now: NOW });
    expect(data.runs).toHaveLength(1);
    expect(data.nextRuns).toEqual([]);
    expect(lastRunOf(data.runs)).toEqual({ lane: 'web', at: '2026-10-11T11:00:00.000Z', outcome: 'pushed' });
    expect(lastRunOf([])).toBeUndefined();
  });

  it('ignores runs older than the window and garbage lines', () => {
    const logs = { core: `not json\n${line({ at: '2026-10-01T00:00:00Z', lane: 'core', units: [], pushed: true })}` };
    expect(buildRuns({ lanes: [{ name: 'web' }, { name: 'core' }], logs, commits: [], now: NOW }).runs).toEqual([]);
  });
});

describe('pause, claims and commit attribution (reviewer findings)', () => {
  const lanes = [{ name: 'core', cron: '0 * * * *' }];
  const known = [commit('old', '2026-10-01T00:00:00Z', 'core')];
  it('a paused loop is not silent: the runs reply "Paused" and log nothing', () => {
    expect(buildRuns({ lanes, logs: {}, commits: known, now: NOW, paused: { at: new Date('2026-10-11T03:00:00Z') } }).silentLanes).toEqual([]);
    expect(buildRuns({ lanes, logs: {}, commits: known, now: NOW, paused: {} }).runs.every((r) => r.kind === 'paused' && r.outcome === 'no-run-recorded')).toBe(true);
    const after = buildRuns({ lanes, logs: {}, commits: known, now: NOW, paused: { at: new Date('2026-10-11T09:30:00Z') } }).runs;
    expect(after.find((r) => r.kind !== 'paused')?.at).toBe('2026-10-11T09:00:00.000Z');
  });
  it('a claimed lane is not silent', () => {
    expect(buildRuns({ lanes: [{ ...lanes[0] as object, name: 'core', stopped: true }], logs: {}, commits: known, now: NOW }).silentLanes).toEqual([]);
  });
  it('a commit of an unlogged session still shows by time; one of another logged session does not', () => {
    const logs = { core: line({ at: '2026-10-11T10:50:00Z', lane: 'core', session: 'sess_AAAAAAAA', units: [], pushed: true }) + line({ at: '2026-10-11T09:50:00Z', lane: 'core', session: 'sess_BBBBBBBB', units: [], pushed: true }) };
    const commits = [commit('unlogged', '2026-10-11T10:10:00Z', 'core', 'ZZZZZZZZ'), commit('theirs', '2026-10-11T10:20:00Z', 'core', 'BBBBBBBB')];
    const runs = buildRuns({ lanes, logs, commits, now: NOW }).runs;
    expect(runs.find((r) => r.at === '2026-10-11T10:00:00.000Z')?.commits.map((c) => c.sha)).toEqual(['unlogged']);
    expect(runs.find((r) => r.at === '2026-10-11T09:00:00.000Z')?.commits.map((c) => c.sha)).toEqual(['theirs']);
  });
});

describe('sessions and live wiring', () => {
  it('reads the Claude-Session trailer as an 8-character key', () => {
    const entry = [{ sha: 'abcdef012', commit: { message: 'x\n\nClaude-Session: https://claude.ai/code/session_01ABCDEFGH\n', committer: { date: '2026-10-11T01:00:00Z' } } }];
    expect(mapCommits(entry)[0]?.session).toBe('01ABCDEFGH'.slice(-8));
    expect(sessionKey('https://claude.ai/code/session_01ABCDEFGH/')).toBe('ABCDEFGH');
  });

  it('buildLiveLoop returns runs, the next slots, the fleet line and no usage-limit item once the routines look off', () => {
    const lanesJson = JSON.stringify({ lanes: [{ name: 'core', owns: ['src/**'], cron: '0 * * * *' }], shared: [] });
    const { detail, inbox } = buildLiveLoop({ slug: 'o/n', commits: [{ sha: 'abcdef012', commit: { message: 'core: x', committer: { date: '2026-10-09T00:00:00Z' } } }], runs: {}, now: NOW, files: { '.ai/lanes.json': lanesJson } });
    expect(detail.runs?.[0]?.outcome).toBe('no-run-recorded');
    expect(detail.nextRuns).toEqual([{ lane: 'core', at: '2026-10-11T13:00:00.000Z' }]);
    expect(detail.lastRun?.outcome).toBe('no-run-recorded');
    // two days of silence is "routines look off" (web's Needs-you row), which replaces the usage-limit item
    expect(detail.runOutcomes?.routinesLookOff).toBe(true);
    expect(inbox.map((i) => i.kind)).toEqual([]);
  });
});

describe('buildRuns with schedule.json (A2)', () => {
  const lanes = [{ name: 'core', cron: '0 * * * *' }];
  const known = [commit('old', '2026-10-01T00:00:00Z', 'core')];
  const sleeping = { version: 1 as const, lanes: { core: { notBefore: null, sleeping: true, paused: false, reason: 'idle' } } };

  it('does not list slots the schedule skipped as missing runs, and a sleeping lane is not silent', () => {
    const without = buildRuns({ lanes, logs: {}, commits: known, now: NOW });
    expect(without.runs.some((r) => r.outcome === 'no-run-recorded')).toBe(true);
    const withSchedule = buildRuns({ lanes, logs: {}, commits: known, now: NOW, schedule: sleeping });
    // Skipped slots of the last 24 h stay for the heat map, as kind 'not-due'; older ones and real misses do not.
    const unexplained = withSchedule.runs.filter((r) => r.outcome === 'no-run-recorded' && r.kind !== 'not-due');
    expect(unexplained).toEqual([]);
    expect(withSchedule.runs.filter((r) => r.kind === 'not-due').length).toBeGreaterThan(0);
    expect(withSchedule.runs.every((r) => r.kind !== 'not-due' || Date.parse(r.at) >= NOW.getTime() - 24 * 3_600_000)).toBe(true);
    expect(withSchedule.silentLanes).toEqual([]);
  });

  it('puts core\'s slot kind on every run and lists paused lanes in the outcomes', () => {
    const logs = { core: line({ at: '2026-10-11T08:30:00Z', lane: 'core', units: ['a'], tests: { passed: 1, failed: 0 }, pushed: true }) + line({ at: '2026-10-11T09:30:00Z', lane: 'core', units: [], pushed: false }) };
    const { runs } = buildRuns({ lanes, logs, commits: known, now: NOW });
    expect(runs.find((r) => r.at === '2026-10-11T08:00:00.000Z')?.kind).toBe('worked');
    expect(runs.find((r) => r.at === '2026-10-11T09:00:00.000Z')?.kind).toBe('idle');
    expect(runs.find((r) => r.at === '2026-10-11T10:00:00.000Z')?.kind).toBe('missed');
    const held = { version: 1 as const, lanes: { core: { notBefore: null, sleeping: false, paused: true, reason: null } } };
    expect(buildRuns({ lanes, logs: {}, commits: known, now: NOW, schedule: held }).outcomes.paused).toEqual(['core']);
    expect(buildRuns({ lanes, logs: {}, commits: known, now: NOW }).outcomes.paused).toEqual([]);
  });

  it('a quiet slot is never the fleet card\'s last run', () => {
    const { runs } = buildRuns({ lanes, logs: {}, commits: known, now: NOW, schedule: sleeping });
    expect(runs[0]?.kind).toBe('not-due');
    expect(lastRunOf(runs)).toBeUndefined();
  });

  it('slots from .ai/PAUSED on read as paused; a stopped lane\'s read as done', () => {
    const paused = buildRuns({ lanes, logs: {}, commits: known, now: NOW, paused: { at: new Date('2026-10-11T09:30:00Z') } }).runs;
    expect(paused.filter((r) => r.kind === 'paused').length).toBeGreaterThan(0);
    const done = buildRuns({ lanes: [{ name: 'core', cron: '0 * * * *', stopped: true }], logs: {}, commits: known, now: NOW }).runs;
    expect(done.length).toBeGreaterThan(0);
    expect(done.every((r) => r.kind === 'done')).toBe(true);
  });

  it('flags routinesLookOff after 6 h of silence with due slots, never when paused', () => {
    const quiet = buildRuns({ lanes, logs: {}, commits: known, now: NOW });
    expect(quiet.routinesLookOff).toBe(true);
    expect(buildRuns({ lanes, logs: {}, commits: known, now: NOW, paused: {} }).routinesLookOff).toBe(false);
    expect(buildRuns({ lanes, logs: {}, commits: known, now: NOW, schedule: sleeping }).routinesLookOff).toBe(false);
  });

  it('a finished or stopped lane never raises routinesLookOff', () => {
    expect(buildRuns({ lanes: [{ name: 'core', cron: '0 * * * *', stopped: true }], logs: {}, commits: known, now: NOW }).routinesLookOff).toBe(false);
  });
});

it('QUIET_KINDS lists the outcomes of lanes that were not expected to run', () => {
  expect([...QUIET_KINDS].sort()).toEqual(['done', 'not-due', 'paused']);
});
