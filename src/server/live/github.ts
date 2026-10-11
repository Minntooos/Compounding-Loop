// Pure mappers from GitHub API JSON to small typed records. Input is untrusted, so every field is checked.
// Author names and emails are never read, so they cannot leak into the dashboard.
import { parseLaneTrailer } from '../../core/parse/index.js';
import type { LoopCommit } from '../../core/types.js';

export interface LiveCommit extends LoopCommit {
  /** Lane named by the `Lane:` trailer, if the commit has one. */
  lane?: string;
}

export interface LiveRun {
  name: string;
  /** `completed`, `in_progress`, `queued`, ... */
  status: string;
  /** `success`, `failure`, ... ; null while the run is still going. */
  conclusion: string | null;
  /** ISO 8601 UTC. */
  at: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined);
const isoOrUndefined = (v: unknown): string | undefined => {
  const s = str(v);
  return s !== undefined && !Number.isNaN(Date.parse(s)) ? new Date(s).toISOString() : undefined;
};

/** `GET /repos/:slug/commits` -> commits, newest first as GitHub returns them. Malformed entries are skipped. */
export function mapCommits(json: unknown): LiveCommit[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((entry): LiveCommit[] => {
    if (!isRecord(entry) || !isRecord(entry.commit)) return [];
    const sha = str(entry.sha);
    const full = str(entry.commit.message);
    const when = isRecord(entry.commit.committer) ? isoOrUndefined(entry.commit.committer.date) : undefined;
    if (sha === undefined || full === undefined || when === undefined) return [];
    const lane = parseLaneTrailer(full);
    return [{ sha: sha.slice(0, 7), at: when, message: full.split(/\r?\n/)[0] ?? full, ...(lane && { lane }) }];
  });
}

/** `GET /repos/:slug/actions/runs` -> runs, newest first as GitHub returns them. */
export function mapRuns(json: unknown): LiveRun[] {
  const runs = isRecord(json) ? json.workflow_runs : undefined;
  if (!Array.isArray(runs)) return [];
  return runs.flatMap((run): LiveRun[] => {
    if (!isRecord(run)) return [];
    const status = str(run.status);
    const at = isoOrUndefined(run.updated_at) ?? isoOrUndefined(run.created_at);
    if (status === undefined || at === undefined) return [];
    return [{ name: str(run.name) ?? 'workflow', status, conclusion: str(run.conclusion) ?? null, at }];
  });
}

/** The newest finished run, which says whether `main` is green right now. */
export function latestFinishedRun(runs: readonly LiveRun[]): LiveRun | undefined {
  return runs.find((r) => r.status === 'completed');
}
