import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { LOCK_MINUTES } from '../core/status.js';
import type { HealthCheck, LaneStatus, LoopFacts } from '../core/types.js';

type Check = Omit<HealthCheck, 'loopId'>;

const minutesBetween = (later: Date, earlier: Date) => (later.getTime() - earlier.getTime()) / 60_000;

/** Every runner in `runners/` fires hourly; a loop on another schedule passes its own period. */
export const DEFAULT_CRON_PERIOD_MINUTES = 60;
/** A run shorter than this did not do a round of work; it was refused (usually a rate limit). */
export const SHORT_RUN_SECONDS = 5;
/** Consecutive short runs before the check fails; one is just a skipped round. */
export const SHORT_RUN_STREAK = 3;

/**
 * Leak check: the site must not publish the repo root, because `.ai/`, CLAUDE.md and IDEA.md would be served.
 * `netlifyToml` is the file's text, or undefined when the repo has none.
 */
export function leakCheck(netlifyToml: string | undefined): Check {
  if (netlifyToml === undefined) return { kind: 'leak', ok: true, reason: 'no netlify.toml: nothing is published by this repo', proof: 'netlify.toml not found' };
  const publish = /^\s*publish\s*=\s*["']([^"']*)["']/m.exec(netlifyToml)?.[1];
  // Only an explicit root counts: a missing publish may be set in the Netlify UI, so it is unknown, not a leak.
  if (publish === undefined) return { kind: 'leak', ok: true, reason: 'netlify.toml sets no publish folder (unknown)', proof: 'publish not set in netlify.toml' };
  const root = ['', '.', './', '/'].includes(publish.trim());
  return root
    ? { kind: 'leak', ok: false, reason: 'netlify.toml publishes the repo root, so .ai/ and CLAUDE.md are public', proof: `publish = ${JSON.stringify(publish)}` }
    : { kind: 'leak', ok: true, reason: `only ${publish} is published`, proof: `publish = ${JSON.stringify(publish)}` };
}

const isRoot = (folder: string) => ['', '.', './', '/'].includes(folder.trim());

/** What each host's config text says is published; only an explicit repo root counts as a leak. */
export interface DeployConfigs {
  /** Text of `vercel.json`. */
  vercel?: string;
  /** Text of `wrangler.toml` (Cloudflare Pages / Workers assets). */
  wrangler?: string;
  /** Text of every `.github/workflows/*.yml`. */
  workflows?: readonly string[];
}

/** Hosts (besides Netlify) whose config publishes the repo root, so `.ai/`, CLAUDE.md and IDEA.md would be served. */
export function rootPublishers(configs: DeployConfigs): string[] {
  const found: string[] = [];
  const vercel = /"outputDirectory"\s*:\s*"([^"]*)"/.exec(configs.vercel ?? '')?.[1];
  if (vercel !== undefined && isRoot(vercel)) found.push(`vercel.json outputDirectory = ${JSON.stringify(vercel)}`);
  const wrangler = /^\s*(?:pages_build_output_dir|directory)\s*=\s*["']([^"']*)["']/m.exec(configs.wrangler ?? '')?.[1];
  if (wrangler !== undefined && isRoot(wrangler)) found.push(`wrangler.toml publishes ${JSON.stringify(wrangler)}`);
  for (const workflow of configs.workflows ?? []) {
    // actions/upload-pages-artifact (GitHub Pages) with no `path` uploads "./_site"; an explicit "." is the repo root.
    const step = /uses:\s*actions\/upload-pages-artifact[^\n]*\n((?:[ \t]+[^\n]*\n?)*)/.exec(workflow)?.[1];
    const pagesPath = /^\s*path:\s*["']?([^"'\s#]*)/m.exec(step ?? '')?.[1];
    if (pagesPath !== undefined && isRoot(pagesPath)) found.push(`GitHub Pages workflow uploads ${JSON.stringify(pagesPath)}`);
  }
  return found;
}

/** The loop's leak check over every host config: Netlify first, then Vercel, Cloudflare Pages and GitHub Pages. */
export function deployLeakCheck(netlifyToml: string | undefined, others: DeployConfigs): Check {
  const netlify = leakCheck(netlifyToml);
  const roots = rootPublishers(others);
  if (netlify.ok && roots.length === 0) return netlify;
  if (!netlify.ok && roots.length === 0) return netlify;
  const reasons = [...(netlify.ok ? [] : [`netlify.toml ${netlify.proof}`]), ...roots];
  return { kind: 'leak', ok: false, reason: 'the repo root is published, so .ai/ and CLAUDE.md are public', proof: reasons.join('; ') };
}

/** Stale lock: a lock older than the lock window with no commit since it was taken means a session died holding it. */
export function staleLockCheck(facts: Pick<LoopFacts, 'lockAt' | 'lastCommitAt'> & Partial<Pick<LoopFacts, 'hasBlocked' | 'hasDone'>>, now: Date): Check {
  const { lockAt, lastCommitAt } = facts;
  // Runs never delete the lock; a loop that stopped on purpose always leaves an old one behind.
  if (facts.hasBlocked || facts.hasDone) return { kind: 'stale-lock', ok: true, reason: 'loop is stopped on purpose', proof: facts.hasDone ? 'DONE.md exists' : 'BLOCKED.md exists' };
  if (!lockAt) return { kind: 'stale-lock', ok: true, reason: 'no lock held', proof: '.ai/session.lock not found' };
  const age = minutesBetween(now, lockAt);
  const committedSince = lastCommitAt !== undefined && lastCommitAt.getTime() > lockAt.getTime();
  const stale = age >= LOCK_MINUTES && !committedSince;
  return {
    kind: 'stale-lock',
    ok: !stale,
    reason: stale ? `lock is ${Math.round(age)} min old and nothing was committed since` : 'lock is fresh or work followed it',
    proof: `lock at ${lockAt.toISOString()}, window ${LOCK_MINUTES} min`,
  };
}

export interface RunRecord {
  startedAt: Date;
  endedAt: Date;
}

/** Parses `.ai/runs.jsonl` (one `{"startedAt","endedAt"}` object per line); bad lines are skipped. */
export function parseRunLog(text: string): RunRecord[] {
  const runs: RunRecord[] = [];
  for (const line of text.split(/\r?\n/)) {
    try {
      const raw = JSON.parse(line) as { startedAt?: unknown; endedAt?: unknown };
      const startedAt = new Date(String(raw.startedAt));
      const endedAt = new Date(String(raw.endedAt));
      if (!Number.isNaN(startedAt.getTime()) && !Number.isNaN(endedAt.getTime())) runs.push({ startedAt, endedAt });
    } catch {
      // not JSON: ignore
    }
  }
  return runs.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
}

/** Short runs: the last few runs all ended within seconds, the signature of a rate-limited account. */
export function shortRunsCheck(runs: readonly RunRecord[]): Check {
  if (runs.length === 0) return { kind: 'short-runs', ok: true, reason: 'no run log yet', proof: '.ai/runs.jsonl not found or empty (`loop run` writes it)' };
  const recent = runs.slice(-SHORT_RUN_STREAK);
  const seconds = recent.map((r) => (r.endedAt.getTime() - r.startedAt.getTime()) / 1000);
  const failing = recent.length === SHORT_RUN_STREAK && seconds.every((s) => s < SHORT_RUN_SECONDS);
  return {
    kind: 'short-runs',
    ok: !failing,
    reason: failing ? `the last ${SHORT_RUN_STREAK} runs each ended in under ${SHORT_RUN_SECONDS} s (rate limit?)` : 'recent runs did real work',
    proof: `last ${recent.length} run durations: ${seconds.map((s) => `${s.toFixed(1)} s`).join(', ')}`,
  };
}

export interface TestRecord {
  passed: number;
  failed: number;
}

/** Parses `.ai/last-test.json` (`{"passed": n, "failed": n}`); undefined when missing or malformed. */
export function parseTestRecord(text: string): TestRecord | undefined {
  try {
    const raw = JSON.parse(text) as { passed?: unknown; failed?: unknown };
    return typeof raw.passed === 'number' && typeof raw.failed === 'number' ? { passed: raw.passed, failed: raw.failed } : undefined;
  } catch {
    return undefined;
  }
}

export function failingTestsCheck(record: TestRecord | undefined): Check {
  if (!record) return { kind: 'failing-tests', ok: true, reason: 'no test result recorded yet', proof: '.ai/last-test.json not found (the template `npm test` writes it; commit it)' };
  return {
    kind: 'failing-tests',
    ok: record.failed === 0,
    reason: record.failed === 0 ? 'all tests pass' : `${record.failed} tests fail`,
    proof: `${record.passed} passed, ${record.failed} failed`,
  };
}

/** Runner silent: nothing committed for more than two cron periods while the loop is still meant to run. */
export function runnerSilentCheck(
  facts: Pick<LoopFacts, 'hasBlocked' | 'hasDone' | 'lockAt' | 'lastCommitAt'>,
  now: Date,
  periodMinutes: number = DEFAULT_CRON_PERIOD_MINUTES,
): Check {
  const limit = periodMinutes * 2;
  if (facts.hasBlocked || facts.hasDone) return { kind: 'runner-silent', ok: true, reason: 'loop is stopped on purpose', proof: facts.hasDone ? 'DONE.md exists' : 'BLOCKED.md exists' };
  const latest = Math.max(facts.lastCommitAt?.getTime() ?? 0, facts.lockAt?.getTime() ?? 0);
  if (latest === 0) return { kind: 'runner-silent', ok: true, reason: 'no activity yet', proof: 'no commits and no lock' };
  const silent = minutesBetween(now, new Date(latest));
  return {
    kind: 'runner-silent',
    ok: silent <= limit,
    reason: silent <= limit ? 'runner is active' : `no commit or lock for ${Math.round(silent)} min (limit ${limit})`,
    proof: `last activity ${new Date(latest).toISOString()}, period ${periodMinutes} min`,
  };
}

/**
 * Lane health for a laned loop. A lane with no commit or lock for more than two cron periods and no stop file
 * is stalled (core's `deriveLaneState` decides). A lane waiting on a finished lane never gets its answer:
 * the failure round 1 hit when the server lane was DONE and web kept waiting for it.
 */
export function laneChecks(lanes: readonly LaneStatus[]): Check[] {
  const done = new Set(lanes.filter((l) => l.state === 'done').map((l) => l.name));
  const stalled = lanes.filter((l) => l.state === 'stalled');
  const orphaned = lanes.flatMap((l) => (l.state === 'done' ? [] : (l.waitingOn ?? []).filter((w) => done.has(w)).map((w) => `${l.name} waits on ${w}`)));
  return [
    {
      kind: 'lane-stalled',
      ok: stalled.length === 0,
      reason: stalled.length === 0 ? 'no lane is stalled' : `stalled: ${stalled.map((l) => l.name).join(', ')} (no commit or lock for over 2 cron periods)`,
      proof: lanes.map((l) => `${l.name}=${l.state}`).join(', '),
    },
    {
      kind: 'lane-waiting-on-finished',
      ok: orphaned.length === 0,
      reason: orphaned.length === 0 ? 'no lane waits on a finished lane' : `waiting on finished lane: ${orphaned.join('; ')}`,
      proof: `done lanes: ${[...done].join(', ') || 'none'}`,
    },
  ];
}

async function readOptional(file: string): Promise<string | undefined> {
  return readFile(file, 'utf8').catch(() => undefined);
}

/** Runs all five checks for one clone, plus the two lane checks when the loop has lanes. */
export async function checkLoop(dir: string, facts: LoopFacts, now: Date, periodMinutes?: number, lanes?: readonly LaneStatus[]): Promise<HealthCheck[]> {
  const workflowDir = path.join(dir, '.github', 'workflows');
  const workflowFiles = (await readdir(workflowDir).catch(() => [] as string[])).filter((f) => /\.ya?ml$/.test(f));
  const [toml, vercel, wrangler, workflows, runLog, testText] = await Promise.all([
    readOptional(path.join(dir, 'netlify.toml')),
    readOptional(path.join(dir, 'vercel.json')),
    readOptional(path.join(dir, 'wrangler.toml')),
    Promise.all(workflowFiles.map((f) => readFile(path.join(workflowDir, f), 'utf8').catch(() => ''))),
    readOptional(path.join(dir, '.ai', 'runs.jsonl')),
    readOptional(path.join(dir, '.ai', 'last-test.json')),
  ]);
  const loopId = path.basename(dir);
  const checks = [
    deployLeakCheck(toml, { ...(vercel !== undefined && { vercel }), ...(wrangler !== undefined && { wrangler }), workflows }),
    staleLockCheck(facts, now),
    // A stopped loop (BLOCKED/DONE) keeps old run records; they say nothing about its health now.
    shortRunsCheck(facts.hasBlocked || facts.hasDone || runLog === undefined ? [] : parseRunLog(runLog)),
    failingTestsCheck(testText === undefined ? undefined : parseTestRecord(testText)),
    runnerSilentCheck(facts, now, periodMinutes),
    ...(lanes ? laneChecks(lanes) : []),
  ];
  return checks.map((c) => ({ loopId, ...c }));
}
