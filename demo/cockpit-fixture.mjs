// Example run data for the demo's "this repo" loop, so the cockpit screens (status strip, Runs, Lanes, Steer,
// schedule) have every outcome to show: worked, idle, limit stop, running, sleeping, snoozed. It is a hand-made
// illustration of a round in progress, anchored at a fixed time so the snapshot never changes; the real data
// comes from live mode. It runs through the same `buildRuns` as live and local data.
import { buildRuns } from '../src/server/runs.ts';

/** The moment the example is drawn at. */
export const FIXTURE_NOW = new Date('2026-10-13T12:40:00Z');

const LANES = [
  // pattern per hourly slot 07..12: w = worked, i = idle, x = due but no run recorded (limit stop), r = still running, . = held back by the schedule
  { name: 'core', cron: '5 * * * *', pattern: 'wwwwww' },
  { name: 'kit', cron: '15 * * * *', pattern: 'wii...' },
  { name: 'server', cron: '25 * * * *', pattern: 'wwxxww' },
  { name: 'web', cron: '35 * * * *', pattern: 'wiwwwr' },
  { name: 'docs', cron: '45 * * * *', pattern: 'iii...' },
];

const SCHEDULE = {
  version: 1,
  lanes: {
    kit: { notBefore: '2026-10-13T15:15:00Z', sleeping: false, paused: false, reason: 'idle twice in a row' },
    docs: { notBefore: null, sleeping: true, paused: false, reason: 'docs waits for the first features' },
  },
};

const STEER = {
  core: `# Steering for the core lane

## 2026-10-13 05:50 UTC · owner · next-run
Ship the pace parser before anything else.
→ done in run 4

## 2026-10-12 21:00 UTC · owner · standing
Keep every new command usable with --json.
→ done in run 1
`,
  server: `# Steering for the server lane

## 2026-10-13 11:30 UTC · owner · next-run
Put run-log fixtures in the demo snapshot first; web is waiting on them.

## 2026-10-13 09:10 UTC · owner · next-run
Add the npm state to every release.
→ not done: npm is only asked in live mode; local mode stays offline

## 2026-10-12 21:00 UTC · owner · standing
Never call npm from local mode.
→ done in run 1
`,
  web: `# Steering for the web lane

## 2026-10-13 10:05 UTC · owner · standing
Keep the phone layout to one thumb: no horizontal scroll at 375 px.
`,
};

// Earlier slots all worked, so the 48 h window has no phantom gaps; the output keeps only the last 12 h.
const PAD = 42;
const SHOWN_HOURS = 12;
const slotAt = (k, minute) => new Date(Date.UTC(2026, 9, 13, 7, Number(minute)) + (k - PAD) * 3_600_000);
const NOTES = { w: 'unit shipped', i: 'nothing to do' };

function logOf({ name, cron, pattern }) {
  const minute = cron.split(' ')[0];
  return [...'w'.repeat(PAD), ...pattern].flatMap((kind, k) => {
    if (!'wi'.includes(kind)) return [];
    const slot = slotAt(k, minute);
    const worked = kind === 'w';
    const entry = {
      at: new Date(slot.getTime() + 12 * 60_000).toISOString(),
      lane: name,
      units: worked ? [`unit ${k + 1}`] : [],
      ...(worked && { tests: { passed: 180 + k, failed: 0 } }),
      pushed: worked,
      note: NOTES[kind],
    };
    return [`${JSON.stringify(entry)}\n`];
  }).join('');
}

/** The cockpit fields for the loop detail: runs, runOutcomes (with nextDue; `nextRuns` stays out until web's strip reads nextDue), idleRuns, schedule, steer, lastRun. */
export function cockpitFixture() {
  const data = buildRuns({
    lanes: LANES.map(({ name, cron }) => ({ name, cron })),
    logs: Object.fromEntries(LANES.map((l) => [l.name, logOf(l)])),
    steerTexts: STEER,
    commits: [],
    now: FIXTURE_NOW,
    schedule: SCHEDULE,
  });
  const shownFrom = FIXTURE_NOW.getTime() - SHOWN_HOURS * 3_600_000;
  const runs = data.runs.filter((r) => new Date(r.at).getTime() >= shownFrom);
  const newest = runs[0];
  return {
    runs,
    runOutcomes: data.outcomes,
    idleRuns: data.idleRuns,
    schedule: SCHEDULE,
    steer: data.steer,
    ...(newest && { lastRun: { lane: newest.lane, at: newest.at, outcome: newest.outcome } }),
  };
}
