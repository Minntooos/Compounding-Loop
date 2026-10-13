// Shared types for the CLI, server and dashboard. Owned by the core lane; other lanes may add, never rename or remove.

/** The five status words from IDEA.md "How status is worked out". */
export type LoopState = 'blocked' | 'done' | 'building' | 'waiting' | 'failing';

/** Facts read from one loop's git clone. Everything the dashboard shows derives from this. */
export interface LoopFacts {
  hasBlocked: boolean;
  hasDone: boolean;
  /** Number of `.ai/done-vN.md` files. */
  roundsDone: number;
  /** UTC time written in `.ai/session.lock`, if the file exists. */
  lockAt?: Date;
  lastCommitAt?: Date;
  /** Reasons from failing health checks; any entry makes the loop "failing". */
  healthFailures: string[];
}

export interface LoopStatus {
  state: LoopState;
  /** Short human reason, shown next to the status word. */
  reason: string;
}

// ---- Added by the server lane: the HTTP API shapes in .ai/contracts.md ----

export interface LoopTestResult {
  passed: number;
  failed: number;
  /** ISO 8601 UTC. */
  at: string;
}

export interface LoopLiveCheck {
  ok: boolean;
  status: number;
  /** Strings that should never appear on the live site (draft markers, secrets) but do. */
  leaked: string[];
}

export interface LoopCommit {
  sha: string;
  /** ISO 8601 UTC. */
  at: string;
  message: string;
  /** Display name of the author, never an email (added in Round 4). */
  author?: string;
  /** Lane the commit belongs to (`Lane:` trailer, then subject prefix; `release` for `Release x.y.z`), else `other` (added by the server lane, Round 4). */
  lane?: string;
  /** Last 8 characters of the `Claude-Session:` trailer id; groups the commits of one run (server lane, Round 4). */
  session?: string;
}

/** One row of the fleet view. */
export interface LoopSummary {
  id: string;
  name: string;
  url?: string;
  state: LoopState;
  reason: string;
  round: number;
  roundsTotal: number;
  run: number;
  runLimit: number;
  /** ISO 8601 UTC. */
  nextRunAt?: string;
  tests?: LoopTestResult;
  live?: LoopLiveCheck;
  pages?: number;
  /** Latest CI run on main (live mode only; added by the web lane). */
  ci?: { ok: boolean; reason: string };
  /** Public demo site, e.g. the repo's GitHub Pages (live mode only; added by the web lane). */
  demoUrl?: string;
  /** ISO time of the newest commit a bundled snapshot contains; absent on live and local data (added by the server lane, Round 4). */
  snapshotAt?: string;
  /** "Round 3 done · 0.3.0" or "Round 4": use instead of "Round N of M" (server lane, Round 4). */
  roundLabel?: string;
  /** Root DONE.md exists: the round is finished and a release waits on the owner. */
  releaseWaiting?: boolean;
  /** The version in package.json is released: its tag exists and, when npm could be checked, npm `latest` equals it (server lane, Round 5). */
  shipped?: { version: string; date?: string; npm: NpmState };
  /** The code repository, when `url` points somewhere else (the loop's site or Pages demo). */
  repoUrl?: string;
  /** `.ai/PAUSED` exists: who paused, when (ISO) and why (server lane, Round 4). Also on the fleet card ("Paused by X since ..."). */
  paused?: { by: string; at?: string; reason?: string };
  /** What the lanes are doing right now, from the run logs and `.ai/schedule.json` (server lane, Round 5). Absent without lanes. */
  runOutcomes?: RunOutcomes;
  /** The newest run of any lane, for the fleet card's one status line. */
  lastRun?: { lane: string; at: string; outcome: LoopRun['outcome'] };
  lastCommit?: LoopCommit;
  /** Present only for loops with `.ai/lanes.json` (added by the server lane). */
  lanes?: LaneStatus[];
}

export interface ContractItem {
  text: string;
  pass: boolean;
}

/** One lane's task-file notes, for laned loops (added by the server lane, Round 4). */
export interface LaneNotes {
  lane: string;
  contract: ContractItem[];
  decisions: string[];
  knowledge: string[];
}

/** One scheduled or recorded lane run (server lane, Round 4). Outcomes are core's `SlotOutcome`. */
export interface LoopRun {
  lane: string;
  /** ISO 8601 UTC: the scheduled slot, or the end of the run when the lane has no cron. */
  at: string;
  outcome: 'pushed' | 'nothing-pushed' | 'tests-failed' | 'no-run-recorded';
  /** Core's slot kind (worked, idle, not-due, paused, done, missed, running, tests-failed) for the heat map; not-due, paused and done slots of the last 24 h are kept. Server lane, Round 5. */
  kind?: 'worked' | 'idle' | 'tests-failed' | 'not-due' | 'running' | 'missed' | 'paused' | 'done';
  /** When the run wrote its log line. */
  endedAt?: string;
  units: string[];
  tests?: { passed: number; failed: number };
  commits: LoopCommit[];
  note?: string;
}

/** Where a version stands on npm: `latest` is the dist-tag, `published` an older version, `unknown` when the registry could not be read (server lane, Round 5). */
export type NpmState = 'latest' | 'published' | 'not-published' | 'unknown';

/** The status strip's run facts for one loop (server lane, Round 5). */
export interface RunOutcomes {
  /** Due slots of the last 5 hours with no run recorded: usage-limit stops or failed starts. */
  limitStops5h: number;
  /** Lanes whose newest slot is still inside the 50-minute run window. */
  running: string[];
  /** Lanes the schedule holds back (sleeping or snoozed; paused lanes are not listed). */
  sleeping: string[];
  /** Lanes paused in schedule.json (server lane, Round 5). */
  paused?: string[];
  /** Nothing logged for 6 h although runs were due: show "Routines look off" once. */
  routinesLookOff: boolean;
  /** The earliest upcoming slot of a lane that will run (its cron, not before its snooze ends). */
  nextDue?: { lane: string; at: string };
}

/** One CHANGELOG release (same shape as core's parsed `Release`), plus its tag and npm state when known. */
export interface LoopRelease {
  version: string;
  date?: string;
  /** A git tag `v<version>` exists; absent when tags were not checked. */
  tag?: boolean;
  npm?: NpmState;
  sections: { title: string; items: string[] }[];
  items: string[];
}

export interface LoopDetail extends LoopSummary {
  /** The control room's newest note for each lane. */
  controlNotes?: { lane: string; at: string; text: string }[];
  /** CHANGELOG.md releases, newest first. */
  releases?: LoopRelease[];
  /** Core's ship-check over the repo files ("Ready to ship" panel); only for laned loops with a root DONE.md. */
  ship?: { ready: boolean; items: { id: string; label: string; ok: boolean; detail: string }[]; openFindings: string[] };
  /** Newest first: each lane's recorded and missing runs of the last two days (loops with lanes). */
  runs?: LoopRun[];
  /** `.ai/schedule.json` as parsed (loops with lanes; absent when the file is). */
  schedule?: Schedule;
  /** Idle runs at the end of each lane's run log (the backoff counts these). */
  idleRuns?: Record<string, number>;
  /** Each lane's `.ai/lanes/<lane>/steer.md` entries, file order (newest first); lanes with a steer file only. */
  steer?: { lane: string; entries: SteerEntry[] }[];
  /** The next scheduled slot of each lane that has a cron. */
  nextRuns?: { lane: string; at: string }[];
  /** Contract, decisions and knowledge of each lane, grouped by lane; absent for loops without lanes. */
  laneNotes?: LaneNotes[];
  /** Newest first. */
  timeline: LoopCommit[];
  contract: ContractItem[];
  knowledge: string[];
  decisions: string[];
  /** Pages over time, oldest first. */
  history: { at: string; pages: number }[];
}

export interface InboxItem {
  loopId: string;
  /** What kind of item this is; absent means a BLOCKED.md question. `release` items have no answer form (server lane, Round 4). */
  kind?: 'question' | 'release' | 'paused' | 'lanes-not-running';
  /** Path of the BLOCKED.md inside the loop's repo. */
  file: string;
  question: string;
  bestGuess: string;
  /** ISO 8601 UTC. */
  since: string;
}

export interface HealthCheck {
  loopId: string;
  kind: 'leak' | 'stale-lock' | 'short-runs' | 'failing-tests' | 'runner-silent' | 'lane-stalled' | 'lane-waiting-on-finished';
  ok: boolean;
  reason: string;
  proof: string;
  /** The check's result in words ("Tests pass", "Tests failing"), not its name; added by the server lane, Round 4. */
  label?: string;
}

/** The whole demo dataset, as written to `demo/five-sites.json`. */
export interface DemoSnapshot {
  generatedAt: string;
  loops: LoopDetail[];
  inbox: InboxItem[];
  checks: HealthCheck[];
}

/** `GET /api/settings`: what the dashboard server is pointed at. Read-only; set with `loop dashboard` flags. */
export interface DashboardSettings {
  demo: boolean;
  /** Absolute folder whose subfolders are loop clones; absent in demo mode. */
  projectsDir?: string;
  /** `gh` login, when `gh` is installed and signed in; absent in demo mode. */
  ghAccount?: string;
  /** The runner the new-loop wizard picks first. */
  defaultRunner: 'routine' | 'github-actions' | 'local';
}

// ---- Added by the core lane: per-lane state for laned loops (see .ai/contracts.md "Requested") ----

export type LaneState = 'building' | 'waiting' | 'blocked' | 'done' | 'stalled';

export interface LaneUnanswered {
  from: string;
  to: string;
  /** ISO 8601 UTC. */
  at: string;
  text: string;
}

export interface LaneStatus {
  name: string;
  state: LaneState;
  run: number;
  limit: number;
  lastCommit?: { sha: string; subject: string; /** ISO 8601 UTC. */ at: string };
  locked: boolean;
  /** Lanes this lane has asked something of and not heard back from. */
  waitingOn?: string[];
  /** Messages other lanes sent to this lane that it has not answered yet. */
  unanswered: LaneUnanswered[];
  /** Unexpired `.ai/lanes/<lane>/claim`, if any (a teammate is working this lane). */
  claim?: { name: string; /** ISO 8601 UTC. */ expiresAt: string };
}

/** One lane's row in `loop next`. */
export interface NextLane {
  name: string;
  state: LaneState;
  /** Unexpired claim, if any. */
  claim?: { name: string; expiresAt: string };
  /** Units in the lane's task file not yet reported done; empty for a done lane. */
  openUnits: { number: number; text: string }[];
}

/** Stable shape of `loop next --json`. */
export interface NextReport {
  /** In `.ai/lanes.json` order. */
  lanes: NextLane[];
  /** First open unit of the first lane that is neither done, blocked nor claimed; absent when there is none. */
  recommended?: { lane: string; unit: { number: number; text: string } };
}

/** One lane's line in `.ai/schedule.json` (Round 5). A missing entry means the lane is due. */
export interface ScheduleEntry {
  /** ISO 8601 UTC; the lane is not due before this time. */
  notBefore: string | null;
  /** Set by the idle backoff after three idle runs in a row; cleared by a wake. */
  sleeping: boolean;
  /** Set by `loop schedule pause`; only a resume clears it. */
  paused: boolean;
  reason: string | null;
}

/** `.ai/schedule.json`. */
export interface Schedule {
  version: 1;
  lanes: Record<string, ScheduleEntry>;
}

/** How much checking a run does, from slowest and safest to fastest (IDEA.md Round 5 B7). */
export type Pace = 'careful' | 'balanced' | 'fast' | 'sprint';

/** `.ai/policy.json`: a global pace and optional per-lane overrides. */
export interface Policy {
  version: 1;
  pace: Pace;
  lanes: Record<string, { pace: Pace }>;
}

/** Who wrote a steer entry for when: the lane's next run only, or every run until removed. */
export type SteerScope = 'next-run' | 'standing';

/** The lane's one-line answer under a steer entry. */
export type SteerAck = { state: 'done'; run: number } | { state: 'not-done'; why: string };

/** One entry of `.ai/lanes/<lane>/steer.md`. */
export interface SteerEntry {
  /** ISO 8601 UTC (minute precision). */
  at: string;
  author: string;
  scope: SteerScope;
  text: string;
  /** Absent while the lane has not read the entry. */
  ack?: SteerAck;
}
