// Pure mappers from GitHub API JSON to small typed records. Input is untrusted, so every field is checked.
// The author's display name is read (never an email); a name that looks like an email is dropped.
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
/** A display name, never an email address (GitHub lets people use their address as `name`). */
const displayName = (v: unknown): string | undefined => {
  const s = str(v)?.trim();
  return s !== undefined && s !== '' && !s.includes('@') ? s.slice(0, 80) : undefined;
};
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
    // GitHub can send a null committer; the author date is the fallback (only the date is read, never a name).
    const dateOf = (who: unknown) => (isRecord(who) ? isoOrUndefined(who.date) : undefined);
    const when = dateOf(entry.commit.committer) ?? dateOf(entry.commit.author);
    if (sha === undefined || full === undefined || when === undefined) return [];
    const lane = parseLaneTrailer(full);
    const author = isRecord(entry.commit.author) ? displayName(entry.commit.author.name) : undefined;
    return [{ sha: sha.slice(0, 7), at: when, message: full.split(/\r?\n/)[0] ?? full, ...(author && { author }), ...(lane && { lane }) }];
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
