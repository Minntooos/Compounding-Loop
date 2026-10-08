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
  lastCommit?: LoopCommit;
}

export interface ContractItem {
  text: string;
  pass: boolean;
}

export interface LoopDetail extends LoopSummary {
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
  /** Path of the BLOCKED.md inside the loop's repo. */
  file: string;
  question: string;
  bestGuess: string;
  /** ISO 8601 UTC. */
  since: string;
}

export interface HealthCheck {
  loopId: string;
  kind: 'leak' | 'stale-lock' | 'short-runs' | 'failing-tests' | 'runner-silent';
  ok: boolean;
  reason: string;
  proof: string;
}

/** The whole demo dataset, as written to `demo/five-sites.json`. */
export interface DemoSnapshot {
  generatedAt: string;
  loops: LoopDetail[];
  inbox: InboxItem[];
  checks: HealthCheck[];
}
