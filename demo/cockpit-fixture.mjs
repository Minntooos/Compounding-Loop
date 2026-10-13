// Example run data for the demo's "this repo" loop, so the cockpit screens (status strip, Runs, Lanes, Steer,
// schedule) have every outcome to show: worked, idle, limit stop, running, sleeping, snoozed. It is a hand-made
// illustration of a round in progress, anchored at a fixed time so the snapshot never changes; the real data
// comes from live mode. It runs through the same `buildRuns` as live and local data.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

/** What `next-round --draft` would read, so the dashboard's dialog lists real-looking ingredients. */
const DRAFT_INPUTS = {
  name: 'compounding-loop',
  round: 6,
  next: [
    { source: '.ai/lanes/core/DONE.md', items: ['`loop pace` per lane in the dashboard', 'Windows path tests for the schedule commands'] },
    { source: '.ai/lanes/web/DONE.md', items: ['Compress the phone screenshots', 'A keyboard shortcut list'] },
  ],
  findings: [{ source: '.ai/audit/server.md', text: 'A3 · HealthCheck.state is missing on local checks' }],
  steer: [{ lane: 'server', entries: [{ at: '2026-10-13T11:30:00.000Z', author: 'owner', scope: 'next-run', text: 'Put run-log fixtures in the demo snapshot first; web is waiting on them.' }] }],
  outOfScope: ['Hosted dashboard', 'Billing'],
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
  // Slots nobody expected a run for are not "the last run".
  const newest = runs.find((r) => !['not-due', 'paused', 'done'].includes(r.kind));
  return {
    runs,
    runOutcomes: data.outcomes,
    idleRuns: data.idleRuns,
    schedule: SCHEDULE,
    // One lane override so the pace UI shows both a loop default and an exception.
    pace: { pace: 'balanced', overrides: { web: 'careful' }, note: 'control room set web to careful: CI red twice in 24 h' },
    steer: data.steer,
    draftInputs: DRAFT_INPUTS,
    ...(newest && { lastRun: { lane: newest.lane, at: newest.at, outcome: newest.outcome } }),
  };
}

/** Lane states matching the run pattern above: web is running now, kit and docs are held back, core and server are mid-round. */
const LANE_STATES = { core: 'building', kit: 'waiting', server: 'building', web: 'building', docs: 'waiting' };

/** The header fields that make the demo's self loop a round 5 in progress, so it agrees with its own run data. */
export function roundFiveHeader(lanes) {
  return {
    state: 'building',
    reason: 'round 5 "Cockpit" is being built by five parallel lanes',
    round: 5,
    roundsTotal: 5,
    roundLabel: 'Round 5 · building',
    snapshotAt: FIXTURE_NOW.toISOString(),
    lanes: lanes.map((l) => ({ ...l, state: LANE_STATES[l.name] ?? l.state })),
  };
}

/** This repo's real commits of 13 Oct up to the fixture's moment (round 5, newest first), so the commit list, lane cards and commits-per-day agree with the run data. */
const ROUND_FIVE_COMMITS = JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'round5-commits.json'), 'utf8'));

// Round 5 done-whens per lane, some still open at the fixture's moment, so the strip counts only the passing ones.
const ROUND_FIVE_CONTRACTS = {
  core: [['`npm test` passes', true], ['Round 5 audit section with no open blocker', true], ['schedule, steer and pace parsers and commands ship with tests', true]],
  kit: [['`npm test` passes', true], ['run-model templates and thin routine prompts ship', true]],
  server: [['`npm test` passes', true], ['Round 5 audit section with no open blocker', false], ['every new route has unit tests and is in contracts.md', true], ['live mode shows the same cockpit fields as the demo', false]],
  web: [['`npm test` passes', true], ['DESIGN.md covers every Round 5 screen', false], ['axe passes on the new screens in both themes', false]],
  docs: [['the dashboard docs describe Steer, Pace and the schedule', false], ['README screenshots are the Round 5 ones', false]],
};

/**
 * Round 5 facts for the demo's self loop: the day's commits on top of the pinned history, lane cards that point at them,
 * per-lane contracts with open items, and the CI status the pace note talks about.
 */
export function roundFiveOverlay(detail) {
  const known = new Set(ROUND_FIVE_COMMITS.map((c) => c.sha));
  const timeline = [...ROUND_FIVE_COMMITS, ...detail.timeline.filter((c) => !known.has(c.sha))];
  const lanes = detail.lanes.map((l) => {
    const last = ROUND_FIVE_COMMITS.find((c) => c.lane === l.name);
    return last ? { ...l, lastCommit: { sha: last.sha, subject: last.message, at: last.at } } : l;
  });
  return {
    timeline,
    lastCommit: timeline[0],
    lanes,
    laneNotes: detail.laneNotes.map((n) => ({ ...n, contract: (ROUND_FIVE_CONTRACTS[n.lane] ?? []).map(([text, pass]) => ({ text, pass })) })),
    ci: { ok: true, reason: 'the latest run on main passed (it was red twice in the last 24 h)' },
  };
}
