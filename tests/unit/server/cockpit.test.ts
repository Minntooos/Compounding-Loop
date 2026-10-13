import { describe, expect, it } from 'vitest';
import type { Schedule } from '../../../src/core/types.js';
import { BASE_FILES, buildLiveLoop, buildRuns } from '../../../src/server/live/index.js';

// 12:20 UTC: the 12:00 slot is 20 minutes old (inside the run window), 11:00 and earlier are settled.
const NOW = new Date('2026-10-11T12:20:00Z');
const line = (o: object) => `${JSON.stringify(o)}\n`;
const lanes = [{ name: 'core', cron: '0 * * * *' }, { name: 'web', cron: '30 * * * *' }, { name: 'docs', cron: '45 * * * *' }];
const ran = (lane: string, at: string, units: string[] = ['u']) => line({ at, lane, units, pushed: units.length > 0 });

describe('buildRuns cockpit data', () => {
  it('counts due slots without a run in the last 5 h as limit stops, and names the lanes running now', () => {
    const logs = { core: ran('core', '2026-10-11T08:20:00Z'), web: ran('web', '2026-10-11T12:05:00Z'), docs: ran('docs', '2026-10-11T12:10:00Z') };
    const { outcomes } = buildRuns({ lanes, logs, commits: [], now: NOW });
    // core: 09, 10, 11 had no run (08:20 answered 08:00); web and docs ran recently. 12:00 core slot is still running.
    expect(outcomes.limitStops5h).toBeGreaterThanOrEqual(3);
    expect(outcomes.running).toEqual(['core']);
    expect(outcomes.routinesLookOff).toBe(false);
  });

  it('a sleeping lane and a snoozed lane are listed as sleeping and never missed; nextDue skips the sleeper and waits out the snooze', () => {
    const schedule: Schedule = { version: 1, lanes: {
      core: { notBefore: null, sleeping: true, paused: false, reason: 'idle' },
      web: { notBefore: '2026-10-11T15:00:00Z', sleeping: false, paused: false, reason: null },
    } };
    const logs = { core: ran('core', '2026-10-11T01:00:00Z', []), web: ran('web', '2026-10-11T01:30:00Z', []), docs: ran('docs', '2026-10-11T12:10:00Z') };
    const { outcomes } = buildRuns({ lanes: lanes.slice(0, 2), logs, commits: [], now: NOW, schedule });
    expect(outcomes.sleeping).toEqual(['core', 'web']);
    expect(outcomes.limitStops5h).toBe(0);
    // core sleeps; web is held until 15:00, so its first slot after the snooze is 15:30.
    expect(outcomes.nextDue).toEqual({ lane: 'web', at: '2026-10-11T15:30:00.000Z' });
  });

  it('paused loop: no limit stops, no next due', () => {
    const { outcomes } = buildRuns({ lanes, logs: {}, commits: [], now: NOW, paused: {} });
    expect(outcomes).toMatchObject({ limitStops5h: 0, running: [] });
    expect(outcomes.nextDue).toBeUndefined();
  });

  it('reports trailing idle runs per lane and parses each lane\'s steer file', () => {
    const logs = { core: ran('core', '2026-10-11T08:00:00Z') + ran('core', '2026-10-11T09:00:00Z', []) + ran('core', '2026-10-11T10:00:00Z', []) };
    const steerTexts = { core: '# Steering\n\n## 2026-10-11 07:00 UTC · owner · next-run\nDo the fixtures.\n→ done in run 3\n', web: undefined };
    const data = buildRuns({ lanes, logs, commits: [], now: NOW, steerTexts });
    expect(data.idleRuns).toEqual({ core: 2, web: 0, docs: 0 });
    expect(data.steer).toEqual([{ lane: 'core', entries: [{ at: '2026-10-11T07:00:00.000Z', author: 'owner', scope: 'next-run', text: 'Do the fixtures.', ack: { state: 'done', run: 3 } }] }]);
  });
});

describe('live file list', () => {
  it('fetches .ai/schedule.json (regression: live mode never read it, so snoozed lanes showed as missed)', () => {
    expect(BASE_FILES).toContain('.ai/schedule.json');
  });

  it('fetches .ai/policy.json and shows the loop pace with lane overrides (live mode had no pace)', () => {
    expect(BASE_FILES).toContain('.ai/policy.json');
    const lanesJson = JSON.stringify({ lanes: [{ name: 'core', owns: ['src/**'] }] });
    const policy = JSON.stringify({ version: 1, pace: 'fast', lanes: { core: { pace: 'careful' } } });
    const files = { '.ai/lanes.json': lanesJson, '.ai/policy.json': policy };
    const { detail } = buildLiveLoop({ slug: 'o/n', commits: [], runs: {}, now: NOW, files });
    expect(detail.pace).toEqual({ pace: 'fast', overrides: { core: 'careful' } });
    expect(buildLiveLoop({ slug: 'o/n', commits: [], runs: {}, now: NOW, files: { '.ai/lanes.json': lanesJson } }).detail.pace).toBeUndefined();
  });
});

describe('routines look off', () => {
  it('reports no limit stops then: the one "Routines look off" message covers the misses', () => {
    const { outcomes } = buildRuns({ lanes: [lanes[0] as (typeof lanes)[number]], logs: { core: ran('core', '2026-10-11T01:00:00Z') }, commits: [], now: NOW });
    expect(outcomes.routinesLookOff).toBe(true);
    expect(outcomes.limitStops5h).toBe(0);
  });
});
