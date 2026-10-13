// Pure: turns fetched GitHub data into the dashboard's existing API shapes (no Node imports, runs in the browser).
import { parseBlocked } from '../../core/blocked.js';
import { activeClaim, commitLane, latestControlNotes, parseChangelog, parsePaused, parseLanesConfig, parseOutbox, parseRunCounter, parseSchedule, parseTaskFile } from '../../core/parse/index.js';
import type { OutboxMessage } from '../../core/parse/index.js';
import { shipCheck } from '../../core/shipCheck.js';
import { deriveLaneState, stallMinutesFor, summarizeOutboxes } from '../../core/laneStatus.js';
import { deriveStatus } from '../../core/status.js';
import type { HealthCheck, InboxItem, LaneStatus, LoopCommit, LoopDetail } from '../../core/types.js';
import { formatUtc, withLabel } from '../checkLabels.js';
import { laneChecks } from '../laneChecks.js';
import { bulletsUnder, contractFromTask, laneNotesFromTask } from '../taskBullets.js';
import { latestFinishedRun, mapCommits, mapRuns, type LiveCommit } from './github.js';
import { packageVersion, releaseInboxItem, roundState } from '../roundState.js';
import { buildRuns, lastRunOf, silentLanesItem } from '../runs.js';
import { annotateReleases, isShipped, npmStateOf, parseNpmPackage } from '../shipped.js';
import { mergeCommits } from './merge.js';
import { countRoundFiles } from './urls.js';

const pausedInfo = (text: string): NonNullable<LoopDetail['paused']> => {
  const { by, at, reason } = parsePaused(text);
  return { by, ...(at && { at: at.toISOString() }), ...(reason && { reason }) };
};

/** Tag names from the GitHub tags response (`name`) or the matching-refs response (`ref: refs/tags/<name>`); anything else is no tags. */
const tagNames = (json: unknown): string[] =>
  Array.isArray(json)
    ? json.flatMap((t: unknown) => {
        const { name, ref } = (typeof t === 'object' && t !== null ? t : {}) as { name?: unknown; ref?: unknown };
        if (typeof name === 'string') return [name];
        return typeof ref === 'string' && ref.startsWith('refs/tags/') ? [ref.slice('refs/tags/'.length)] : [];
      })
    : [];

const pausedAtOf = (text: string): { at?: Date } => {
  const { at } = parsePaused(text);
  return at ? { at } : {};
};

/** Runs kept in the loop detail (newest first); older ones stay in git. */
const MAX_RUNS = 400; // 48 h of 5 lanes' slots plus the quiet ones the heat map keeps

export interface LiveInput {
  /** `owner/name` */
  slug: string;
  /** Loop id to use instead of the repo name (the `loop` field of `live.json`). */
  id?: string;
  /** Parsed JSON of the commits (concatenate the pages) and Actions runs responses (any shape; bad data maps to empty). */
  commits: unknown;
  /** Commits of the bundled snapshot (full history up to its pin); merged under the live ones without duplicates. */
  snapshotCommits?: readonly LoopCommit[];
  runs: unknown;
  /** Parsed JSON of the tags response (`tagsApiUrl` or `tagLookupApiUrl`); without it the ship-check assumes the tag is free. */
  tags?: unknown;
  /** Parsed JSON of npm's package document (`npmPackageUrl`); without it, or if unreadable, npm state is unknown and the tag alone decides. */
  npm?: unknown;
  /** The loop's public site (the repo's GitHub Pages), from `live.json`; shown as the site instead of the repo. */
  pagesUrl?: string;
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
  const laneConfig = parseLanesConfig(input.files['.ai/lanes.json'] ?? '').config?.lanes ?? [];
  const laneNames = laneConfig.map((l) => l.name);
  // Trailer first, then the subject prefix (`Release x.y.z` is lane "release"); every commit gets a lane.
  const commits = mapCommits(input.commits).map((c) => ({ ...c, lane: commitLane(c.lane ? `${c.message}\n\nLane: ${c.lane}` : c.message, laneNames) }));
  const latestRun = latestFinishedRun(mapRuns(input.runs));
  const lanes = lanesOf(input, commits);
  const hasBlocked = input.files['BLOCKED.md'] !== undefined;
  const taskText = input.files['.ai/task.md'] ?? '';
  const task = parseTaskFile(taskText);
  const checks: HealthCheck[] = [];
  if (latestRun) {
    const ok = latestRun.conclusion === 'success';
    checks.push({ loopId: id, kind: 'failing-tests', ok, reason: ok ? 'latest CI run on main passed' : `latest CI run on main ${latestRun.conclusion ?? latestRun.status}`, proof: `${latestRun.name} at ${formatUtc(latestRun.at)}` });
  }
  if (lanes) checks.push(...laneChecks(lanes).map((c) => ({ ...c, loopId: id })));
  const roundsDone = countRoundFiles(input.files);
  const timeline = mergeCommits(input.snapshotCommits ?? [], commits);
  const newest = timeline[0];
  const status = deriveStatus({
    hasBlocked,
    hasDone: input.files['DONE.md'] !== undefined,
    roundsDone,
    ...(newest && { lastCommitAt: new Date(newest.at) }),
    healthFailures: checks.filter((c) => !c.ok).map((c) => c.reason),
  }, input.now);
  const round = roundsDone + 1;
  const laneBudget = (lanes ?? []).reduce((n, l) => ({ run: n.run + l.run, limit: n.limit + l.limit }), { run: 0, limit: 0 });
  const hasDone = input.files['DONE.md'] !== undefined;
  const version = packageVersion(input.files['package.json']);
  const tags = tagNames(input.tags);
  const npm = parseNpmPackage(input.npm);
  const shippedNow = hasDone && version !== undefined && isShipped({ version, tagExists: tags.includes(`v${version}`), npm });
  const { roundLabel, releaseWaiting } = roundState({ round, hasDone, laned: lanes !== undefined, shipped: shippedNow, ...(version && { version }) });
  const repoUrl = `https://github.com/${input.slug}`;
  const pausedText = input.files['.ai/PAUSED'];
  const paused = pausedText === undefined ? undefined : pausedAtOf(pausedText);
  const runsData = lanes
    ? buildRuns({ steerTexts: Object.fromEntries(laneNames.map((n) => [n, input.files[`.ai/lanes/${n}/steer.md`]])), lanes: laneConfig.map((l) => ({ name: l.name, ...(l.cron && { cron: l.cron }), stopped: hasDone || ['done', 'blocked'].includes(lanes.find((s) => s.name === l.name)?.state ?? '') || lanes.find((s) => s.name === l.name)?.claim !== undefined })), logs: Object.fromEntries(laneNames.map((n) => [n, input.files[`.ai/lanes/${n}/runs.jsonl`]])), commits: timeline, now: input.now, ...(input.files['.ai/schedule.json'] !== undefined && { schedule: parseSchedule(input.files['.ai/schedule.json']) }), ...(paused && { paused }) })
    : undefined;
  const schedule = input.files['.ai/schedule.json'] === undefined ? undefined : parseSchedule(input.files['.ai/schedule.json']);
  const lastRun = runsData && lastRunOf(runsData.runs);
  const controlText = input.files['.ai/control-room.md'];
  const notes = controlText === undefined || !lanes ? [] : Object.entries(latestControlNotes(controlText, laneNames)).map(([lane, n]) => ({ lane, at: n.at, text: n.text }));
  const changelogText = input.files['CHANGELOG.md'];
  const newestTests = runsData?.runs.find((r) => r.tests && r.endedAt);
  const ship = hasDone && lanes && version && !shippedNow
    ? shipCheck({
        version,
        doneText: input.files['DONE.md'] as string,
        ...(changelogText !== undefined && { changelogText }),
        tagExists: tags.includes(`v${version}`),
        // A remote repo has no working tree to be dirty.
        treeClean: true,
        ...(newestTests?.tests && { tests: { ...newestTests.tests, ...(newestTests.endedAt && { at: newestTests.endedAt }) } }),
      })
    : undefined;
  const releaseDate = version ? parseChangelog(changelogText ?? '').find((r) => r.version === version)?.date : undefined;
  const detail: LoopDetail = {
    id,
    name: id,
    url: input.pagesUrl ?? repoUrl,
    repoUrl,
    ...(input.pagesUrl && { demoUrl: input.pagesUrl }),
    state: status.state,
    reason: releaseWaiting && status.state === 'done' ? `${roundLabel} · release waiting on you` : status.reason,
    roundLabel,
    ...(pausedText !== undefined && { paused: pausedInfo(pausedText) }),
    ...(notes.length > 0 && { controlNotes: notes }),
    ...(changelogText !== undefined && { releases: annotateReleases(parseChangelog(changelogText), input.tags === undefined ? undefined : tags, npm) }),
    ...(ship && { ship }),
    ...(lastRun && { lastRun }),
    ...(runsData && { runs: runsData.runs.slice(0, MAX_RUNS), nextRuns: runsData.nextRuns, runOutcomes: runsData.outcomes, idleRuns: runsData.idleRuns, ...(schedule && { schedule }), ...(runsData.steer.length > 0 && { steer: runsData.steer }) }),
    ...(releaseWaiting && { releaseWaiting }),
    ...(shippedNow && version && { shipped: { version, ...(releaseDate && { date: releaseDate }), npm: npmStateOf(version, npm) } }),
    round,
    roundsTotal: round,
    // A laned loop's budget is its lanes' budgets; the root task file has none.
    run: laneBudget.limit > 0 ? laneBudget.run : (task.run?.run ?? 0),
    runLimit: laneBudget.limit > 0 ? laneBudget.limit : (task.run?.limit ?? 0),
    ...(timeline[0] && { lastCommit: timeline[0] }),
    ...(lanes && { lanes }),
    timeline,
    ...(laneNames.length > 0 && { laneNotes: laneNames.map((lane) => laneNotesFromTask(lane, input.files[`.ai/lanes/${lane}/task.md`] ?? '', hasDone || input.files[`.ai/lanes/${lane}/DONE.md`] !== undefined)) }),
    contract: contractFromTask(taskText, input.files['DONE.md'] !== undefined),
    knowledge: bulletsUnder(taskText, /^confirmed/i),
    decisions: bulletsUnder(taskText, /^decisions/i),
    history: [],
  };
  const blockedText = input.files['BLOCKED.md'];
  const inbox: InboxItem[] = blockedText === undefined ? [] : [{ loopId: id, file: 'BLOCKED.md', ...pick(parseBlocked(blockedText)), since: (newest ?? { at: input.now.toISOString() }).at }];
  const silent = runsData && silentLanesItem(id, runsData.silentLanes, input.now.toISOString(), runsData.routinesLookOff);
  if (silent) inbox.push(silent);
  if (releaseWaiting) inbox.push(releaseInboxItem(id, version, (newest ?? { at: input.now.toISOString() }).at));
  return { detail, inbox, checks: checks.map(withLabel) };
}

const pick = ({ question, bestGuess }: { question: string; bestGuess: string }) => ({ question, bestGuess });
