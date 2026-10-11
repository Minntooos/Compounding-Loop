// Pure: turns fetched GitHub data into the dashboard's existing API shapes (no Node imports, runs in the browser).
import { parseBlocked } from '../../core/blocked.js';
import { activeClaim, parseLanesConfig, parseOutbox, parseRunCounter, parseTaskFile } from '../../core/parse/index.js';
import type { OutboxMessage } from '../../core/parse/index.js';
import { deriveLaneState, stallMinutesFor, summarizeOutboxes } from '../../core/laneStatus.js';
import { deriveStatus } from '../../core/status.js';
import type { HealthCheck, InboxItem, LaneStatus, LoopDetail } from '../../core/types.js';
import { laneChecks } from '../laneChecks.js';
import { bulletsUnder, contractFromTask } from '../taskBullets.js';
import { latestFinishedRun, mapCommits, mapRuns, type LiveCommit } from './github.js';
import { countRoundFiles } from './urls.js';

export interface LiveInput {
  /** `owner/name` */
  slug: string;
  /** Loop id to use instead of the repo name (the `loop` field of `live.json`). */
  id?: string;
  /** Parsed JSON of the commits and Actions runs responses (any shape; bad data maps to empty). */
  commits: unknown;
  runs: unknown;
  /** Raw file text by repo-relative path; a file that 404ed is absent or undefined. */
  files: Readonly<Record<string, string | undefined>>;
  now: Date;
}

export interface LiveLoop {
  detail: LoopDetail;
  inbox: InboxItem[];
  checks: HealthCheck[];
}

function lanesOf(input: LiveInput, commits: readonly LiveCommit[]): LaneStatus[] | undefined {
  const text = input.files['.ai/lanes.json'];
  const config = text === undefined ? undefined : parseLanesConfig(text).config;
  if (!config) return undefined;
  const file = (lane: string, name: string) => input.files[`.ai/lanes/${lane}/${name}`];
  const outboxes = new Map<string, OutboxMessage[]>();
  const partial = config.lanes.map(({ name, cron }) => {
    outboxes.set(name, parseOutbox(name, file(name, 'outbox.md') ?? ''));
    const newest = commits.find((c) => c.lane === name);
    const counter = parseRunCounter(file(name, 'task.md') ?? '');
    const state = deriveLaneState({
      hasDone: file(name, 'DONE.md') !== undefined || input.files['DONE.md'] !== undefined,
      hasBlocked: file(name, 'BLOCKED.md') !== undefined || input.files['BLOCKED.md'] !== undefined,
      stallMinutes: stallMinutesFor(cron),
      ...(newest && { lastCommitAt: new Date(newest.at) }),
    }, input.now);
    const claim = activeClaim(file(name, 'claim'), input.now);
    return {
      name,
      state,
      run: counter?.run ?? 0,
      limit: counter?.limit ?? 0,
      // A lock file is gitignored, so a lane can never read as locked from GitHub alone.
      locked: false,
      ...(newest && { lastCommit: { sha: newest.sha, subject: newest.message, at: newest.at } }),
      ...(claim && { claim: { name: claim.name, expiresAt: claim.expiresAt.toISOString() } }),
    };
  });
  const commitTimes = new Map(partial.flatMap((l) => (l.lastCommit ? [[l.name, `${l.lastCommit.at.slice(0, 16)}:00.000Z`] as const] : [])));
  const { unanswered, waitingOn } = summarizeOutboxes(outboxes, commitTimes);
  return partial.map((lane) => ({ ...lane, ...(waitingOn.has(lane.name) && { waitingOn: waitingOn.get(lane.name) as string[] }), unanswered: unanswered.get(lane.name) ?? [] }));
}

/** Builds one loop's detail, inbox and health checks from what the browser fetched. */
export function buildLiveLoop(input: LiveInput): LiveLoop {
  const id = input.id ?? input.slug.split('/')[1] ?? input.slug;
  const commits = mapCommits(input.commits);
  const latestRun = latestFinishedRun(mapRuns(input.runs));
  const lanes = lanesOf(input, commits);
  const hasBlocked = input.files['BLOCKED.md'] !== undefined;
  const taskText = input.files['.ai/task.md'] ?? '';
  const task = parseTaskFile(taskText);
  const checks: HealthCheck[] = [];
  if (latestRun) {
    const ok = latestRun.conclusion === 'success';
    checks.push({ loopId: id, kind: 'failing-tests', ok, reason: ok ? 'latest CI run on main passed' : `latest CI run on main ${latestRun.conclusion ?? latestRun.status}`, proof: `${latestRun.name} at ${latestRun.at}` });
  }
  if (lanes) checks.push(...laneChecks(lanes).map((c) => ({ ...c, loopId: id })));
  const roundsDone = countRoundFiles(input.files);
  const newest = commits[0];
  const status = deriveStatus({
    hasBlocked,
    hasDone: input.files['DONE.md'] !== undefined,
    roundsDone,
    ...(newest && { lastCommitAt: new Date(newest.at) }),
    healthFailures: checks.filter((c) => !c.ok).map((c) => c.reason),
  }, input.now);
  const round = roundsDone + 1;
  const timeline = commits.map(({ sha, at, message }) => ({ sha, at, message }));
  const detail: LoopDetail = {
    id,
    name: id,
    url: `https://github.com/${input.slug}`,
    state: status.state,
    reason: status.reason,
    round,
    roundsTotal: round,
    run: task.run?.run ?? 0,
    runLimit: task.run?.limit ?? 0,
    ...(timeline[0] && { lastCommit: timeline[0] }),
    ...(lanes && { lanes }),
    timeline,
    contract: contractFromTask(taskText, input.files['DONE.md'] !== undefined),
    knowledge: bulletsUnder(taskText, /^confirmed/i),
    decisions: bulletsUnder(taskText, /^decisions/i),
    history: [],
  };
  const blockedText = input.files['BLOCKED.md'];
  const inbox: InboxItem[] = blockedText === undefined ? [] : [{ loopId: id, file: 'BLOCKED.md', ...pick(parseBlocked(blockedText)), since: (newest ?? { at: input.now.toISOString() }).at }];
  return { detail, inbox, checks };
}

const pick = ({ question, bestGuess }: { question: string; bestGuess: string }) => ({ question, bestGuess });
