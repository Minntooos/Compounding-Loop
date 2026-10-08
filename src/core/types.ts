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
