import { execFile } from 'node:child_process';
import { readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { runAnswer } from '../cli/loops.js';
import { runDoctor } from '../cli/doctor.js';
import { runLaneRound } from '../cli/laneRound.js';
import { runPause, runResume } from '../cli/pause.js';
import { runScheduleAction, runSteer } from '../cli/schedule.js';
import { readLaneStatuses } from '../cli/laneStatus.js';
import { parseLanesConfig } from '../core/lanes.js';
import { parseBlocked } from '../core/blocked.js';
import { readLoopFacts, readRunCounter } from '../core/repo.js';
import { deriveStatus } from '../core/status.js';
import type { ContractItem, InboxItem, LaneStatus, LoopCommit, LoopDetail, LoopSummary, LoopTestResult } from '../core/types.js';
import { annotateReleases, isShipped } from './shipped.js';
import { homepageOf, packageVersion, releaseInboxItem, roundState } from './roundState.js';
import { commitLane, latestControlNotes, parseChangelog, parsePaused, parseSchedule } from '../core/parse/index.js';
import { shipCheck } from '../core/shipCheck.js';
import { buildRuns, lastRunOf, sessionKey, silentLanesItem } from './runs.js';
import { checkLoop, parseTestRecord } from './health.js';
import { bulletsUnder, contractFromTask, laneNotesFromTask } from './taskBullets.js';

export { bulletsUnder, contractFromTask };
import { sortByAttention, toSummary, type DataSource } from './data.js';

const execFileAsync = promisify(execFile);

async function readOptional(file: string): Promise<string | undefined> {
  return readFile(file, 'utf8').catch(() => undefined);
}

/** Recent commits of a clone, newest first. Empty when the folder is not a repo. `laneNames` lets the subject prefix name a lane. */
export async function readTimeline(dir: string, limit = 50, laneNames: readonly string[] = []): Promise<LoopCommit[]> {
  try {
    const { stdout } = await execFileAsync('git', ['log', `-${limit}`, '--format=%h%x1f%cI%x1f%an%x1f%s%x1f%b%x1e'], {
      cwd: dir,
      env: { ...process.env, GIT_CEILING_DIRECTORIES: path.dirname(path.resolve(dir)) },
    });
    return stdout
      .split('\x1e')
      .map((record) => record.trim())
      .filter(Boolean)
      .map((record) => {
        const [sha = '', at = '', name = '', subject = '', body = ''] = record.split('\x1f');
        const author = name.trim();
        const session = /^Claude-Session:\s*(\S+)\s*$/m.exec(body)?.[1];
        return {
          sha,
          at: new Date(at).toISOString(),
          message: subject,
          // A name that is an email address is not a display name.
          ...(author && !author.includes('@') && { author }),
          lane: commitLane(`${subject}\n\n${body}`, laneNames),
          ...(session && { session: sessionKey(session) }),
        };
      });
  } catch {
    return [];
  }
}

function pausedInfo(text: string): NonNullable<LoopSummary['paused']> {
  const { by, at, reason } = parsePaused(text);
  return { by, ...(at && { at: at.toISOString() }), ...(reason && { reason }) };
}

async function readRuns(dir: string, lanes: readonly LaneStatus[], lanesJson: string | undefined, timeline: readonly LoopCommit[], now: Date) {
  const cron = new Map((parseLanesConfig(lanesJson ?? '').config?.lanes ?? []).map((l) => [l.name, l.cron] as const));
  const pausedText = await readOptional(path.join(dir, '.ai', 'PAUSED'));
  const scheduleText = await readOptional(path.join(dir, '.ai', 'schedule.json'));
  const schedule = scheduleText === undefined ? undefined : parseSchedule(scheduleText);
  const pausedAt = pausedText === undefined ? undefined : parsePaused(pausedText).at;
  const laneNames = lanes.map((l) => l.name);
  const logs = Object.fromEntries(await Promise.all(laneNames.map(async (n) => [n, await readOptional(path.join(dir, '.ai', 'lanes', n, 'runs.jsonl'))] as const)));
  const steerTexts = Object.fromEntries(await Promise.all(laneNames.map(async (n) => [n, await readOptional(path.join(dir, '.ai', 'lanes', n, 'steer.md'))] as const)));
  const data = buildRuns({ steerTexts, lanes: laneNames.map((name) => ({ name, ...(cron.get(name) && { cron: cron.get(name) as string }), stopped: ['done', 'blocked'].includes(lanes.find((l) => l.name === name)?.state ?? '') || lanes.find((l) => l.name === name)?.claim !== undefined })), logs, commits: timeline, now, ...(schedule && { schedule }), ...(pausedText !== undefined && { paused: pausedAt ? { at: pausedAt } : {} }) });
  return { ...data, ...(schedule && { schedule }) };
}

/** Local git facts for the ship-check; a failing git call reads as the safe answer (tag free, tree dirty). */
async function readShipGit(dir: string, tag: string): Promise<{ tagExists: boolean; treeClean: boolean; tags?: string[]; tagAt?: Date; doneAt?: Date }> {
  const git = (args: string[]) => execFileAsync('git', args, { cwd: dir, timeout: 15_000 }).then((r) => r.stdout, () => undefined);
  const [tagList, status] = await Promise.all([git(['tag', '--list', 'v*']), git(['status', '--porcelain'])]);
  const tags = (tagList ?? '').split('\n').map((t) => t.trim()).filter((t) => t !== '');
  const tagExists = tags.includes(tag);
  const [tagOut, doneOut] = tagExists ? await Promise.all([git(['log', '-1', '--format=%cI', tag]), git(['log', '-1', '--format=%cI', '--', 'DONE.md'])]) : [undefined, undefined];
  const date = (out: string | undefined) => (out && !Number.isNaN(Date.parse(out.trim())) ? new Date(out.trim()) : undefined);
  const [tagAt, doneAt] = [date(tagOut), date(doneOut)];
  return { tagExists, treeClean: status !== undefined && status.trim() === '', ...(tagList !== undefined && { tags }), ...(tagAt && { tagAt }), ...(doneAt && { doneAt }) };
}

/** `.ai/last-test.json` as a card result, dated by the file's mtime; undefined when absent or malformed. */
async function readTestFile(dir: string): Promise<LoopTestResult | undefined> {
  const file = path.join(dir, '.ai', 'last-test.json');
  const [text, info] = await Promise.all([readOptional(file), stat(file).catch(() => undefined)]);
  const record = text === undefined ? undefined : parseTestRecord(text);
  return record && info ? { ...record, at: info.mtime.toISOString() } : undefined;
}

/** Reads one clone into the API's LoopDetail. `now` is a parameter so tests are deterministic. */
export async function readLoop(dir: string, now: Date = new Date()): Promise<LoopDetail> {
  const lanes = await readLaneStatuses(dir, now);
  const laneNames = lanes?.map((l) => l.name) ?? [];
  const [baseFacts, counter, timeline, taskText, packageText, lanesJson] = await Promise.all([
    readLoopFacts(dir),
    readRunCounter(dir),
    readTimeline(dir, 300, laneNames),
    readOptional(path.join(dir, '.ai', 'task.md')),
    readOptional(path.join(dir, 'package.json')),
    readOptional(path.join(dir, '.ai', 'lanes.json')),
  ]);
  const [changelogText, controlText, pausedText] = await Promise.all(['CHANGELOG.md', path.join('.ai', 'control-room.md'), path.join('.ai', 'PAUSED')].map((f) => readOptional(path.join(dir, f))));
  const notes = controlText === undefined || !lanes ? [] : Object.entries(latestControlNotes(controlText, laneNames)).map(([lane, n]) => ({ lane, at: n.at, text: n.text }));
  const runsData = lanes && (await readRuns(dir, lanes, lanesJson, timeline, now));
  // Any failing health check turns the loop "failing" with that check's reason (IDEA.md status rule 5).
  const checks = await checkLoop(dir, baseFacts, now, undefined, lanes);
  const facts = { ...baseFacts, healthFailures: checks.filter((c) => !c.ok).map((c) => c.reason) };
  const status = deriveStatus(facts, now);
  const round = facts.roundsDone + 1;
  const task = taskText ?? '';
  const version = packageVersion(packageText);
  const shipGit = version ? await readShipGit(dir, `v${version}`) : undefined;
  // npm is not asked locally (no network in a dashboard that works offline): the tag alone decides.
  const shippedNow = facts.hasDone && version !== undefined && shipGit !== undefined && isShipped({ version, tagExists: shipGit.tagExists, tagAt: shipGit.tagAt, doneAt: shipGit.doneAt });
  const { roundLabel, releaseWaiting } = roundState({ round, hasDone: facts.hasDone, laned: lanes !== undefined, shipped: shippedNow, ...(version && { version }) });
  const releaseDate = version ? parseChangelog(changelogText ?? '').find((r) => r.version === version)?.date : undefined;
  const doneText = lanes && version ? await readOptional(path.join(dir, 'DONE.md')) : undefined;
  const newestTests = runsData?.runs.find((r) => r.tests && r.endedAt);
  const ship = doneText !== undefined && version && shipGit && !shippedNow
    ? shipCheck({
        version,
        doneText,
        ...(changelogText !== undefined && { changelogText }),
        tagExists: shipGit.tagExists,
        treeClean: shipGit.treeClean,
        ...(newestTests?.tests && { tests: { ...newestTests.tests, ...(newestTests.endedAt && { at: newestTests.endedAt }) } }),
      })
    : undefined;
  // The same card fields the live and demo loops carry (Round 5 A7): CI from the tests check, newest test result, site.
  const ciCheck = checks.find((c) => c.kind === 'failing-tests');
  const site = homepageOf(packageText);
  const cardTests = newestTests?.tests && newestTests.endedAt ? { ...newestTests.tests, at: newestTests.endedAt } : await readTestFile(dir);
  return {
    id: path.basename(dir),
    name: path.basename(dir),
    ...(site && { url: site, demoUrl: site }),
    ...(ciCheck && { ci: { ok: ciCheck.ok, reason: ciCheck.reason } }),
    ...(cardTests && { tests: cardTests }),
    state: status.state,
    reason: releaseWaiting && status.state === 'done' ? `${roundLabel} · release waiting on you` : status.reason,
    roundLabel,
    ...(pausedText !== undefined && { paused: pausedInfo(pausedText) }),
    ...(notes.length > 0 && { controlNotes: notes }),
    ...(changelogText !== undefined && { releases: annotateReleases(parseChangelog(changelogText), shipGit?.tags, undefined) }),
    ...(runsData && lastRunOf(runsData.runs) && { lastRun: lastRunOf(runsData.runs) }),
    ...(runsData && { runs: runsData.runs, nextRuns: runsData.nextRuns, runOutcomes: runsData.outcomes, idleRuns: runsData.idleRuns, ...(runsData.schedule && { schedule: runsData.schedule }), ...(runsData.steer.length > 0 && { steer: runsData.steer }) }),
    ...(ship && { ship }),
    ...(releaseWaiting && { releaseWaiting }),
    ...(shippedNow && version && { shipped: { version, ...(releaseDate && { date: releaseDate }), npm: 'unknown' as const } }),
    round,
    // The total is unknown for a real loop (the owner can always add a round), so it never reads "5 of 3".
    roundsTotal: round,
    run: counter?.run ?? 0,
    runLimit: counter?.limit ?? 0,
    ...(timeline[0] && { lastCommit: timeline[0] }),
    ...(lanes && { lanes }),
    timeline,
    ...(lanes && { laneNotes: await Promise.all(lanes.map(async ({ name }) => laneNotesFromTask(name, (await readOptional(path.join(dir, '.ai', 'lanes', name, 'task.md'))) ?? '', facts.hasDone || (await readOptional(path.join(dir, '.ai', 'lanes', name, 'DONE.md'))) !== undefined))) }),
    contract: contractFromTask(task, facts.hasDone),
    knowledge: bulletsUnder(task, /^confirmed/i),
    decisions: bulletsUnder(task, /^decisions/i),
    history: [],
  };
}

/** Subfolders of `projectsDir` that look like loop clones (a `.ai` folder). */
export async function findLoopDirs(projectsDir: string): Promise<string[]> {
  const entries = await readdir(projectsDir, { withFileTypes: true }).catch(() => []);
  const dirs: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const dir = path.join(projectsDir, entry.name);
    if ((await stat(path.join(dir, '.ai')).catch(() => undefined))?.isDirectory()) dirs.push(dir);
  }
  return dirs.sort();
}

async function readReleaseItem(dir: string): Promise<InboxItem | undefined> {
  const file = path.join(dir, 'DONE.md');
  const [info, laned] = await Promise.all([stat(file).catch(() => undefined), stat(path.join(dir, '.ai', 'lanes.json')).catch(() => undefined)]);
  if (!info || !laned) return undefined;
  const version = packageVersion(await readOptional(path.join(dir, 'package.json')));
  const git = version ? await readShipGit(dir, `v${version}`) : undefined;
  if (version && git && isShipped({ version, tagExists: git.tagExists, tagAt: git.tagAt, doneAt: git.doneAt })) return undefined;
  return releaseInboxItem(path.basename(dir), version, info.mtime.toISOString());
}

async function readSilentItem(dir: string, now: Date): Promise<InboxItem | undefined> {
  const lanes = await readLaneStatuses(dir, now);
  if (!lanes) return undefined;
  const names = lanes.map((l) => l.name);
  const runs = await readRuns(dir, lanes, await readOptional(path.join(dir, '.ai', 'lanes.json')), await readTimeline(dir, 300, names), now);
  return silentLanesItem(path.basename(dir), runs.silentLanes, now.toISOString());
}

async function readInboxItem(dir: string): Promise<InboxItem | undefined> {
  const file = path.join(dir, 'BLOCKED.md');
  const [text, info] = await Promise.all([readOptional(file), stat(file).catch(() => undefined)]);
  if (text === undefined || !info) return undefined;
  const note = parseBlocked(text);
  return { loopId: path.basename(dir), file: 'BLOCKED.md', question: note.question, bestGuess: note.bestGuess, since: info.mtime.toISOString() };
}

/** Best effort: a clone without a remote (or offline) keeps the commit and the loop pulls it later. */
const pushQuietly = (dir: string) =>
  execFileAsync('git', ['push'], { cwd: dir, timeout: 30_000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }).then(() => true, () => false);

/** A DataSource over a folder of loop clones, re-read on every call so the dashboard is never stale. */
export function projectsSource(projectsDir: string, now: () => Date = () => new Date()): DataSource {
  const all = async () => Promise.all((await findLoopDirs(projectsDir)).map((dir) => readLoop(dir, now())));
  // Match the id against folder names; never build a path from it.
  // One git-changing action per clone at a time: a double click must not race on index.lock.
  const busy = new Set<string>();
  const exclusive = async <T>(dir: string, run: () => Promise<T>): Promise<T> => {
    if (busy.has(dir)) throw new Error('Another action on this loop is still running; try again in a moment.');
    busy.add(dir);
    try {
      return await run();
    } finally {
      busy.delete(dir);
    }
  };
  const loopDir = async (id: string) => (await findLoopDirs(projectsDir)).find((d) => path.basename(d) === id);
  return {
    loops: async () => sortByAttention((await all()).map(toSummary)),
    loop: async (id) => {
      const dir = await loopDir(id);
      return dir === undefined ? undefined : readLoop(dir, now());
    },
    inbox: async () => {
      const dirs = await findLoopDirs(projectsDir);
      const items = [...(await Promise.all(dirs.map(readInboxItem))), ...(await Promise.all(dirs.map(readReleaseItem))), ...(await Promise.all(dirs.map((d) => readSilentItem(d, now()))))];
      return items.filter((i): i is InboxItem => i !== undefined).sort((a, b) => a.since.localeCompare(b.since));
    },
    answer: async (id, answer) => {
      const dir = await loopDir(id);
      if (dir === undefined) return undefined;
      // runAnswer reads the exact word "accept" as "use the best guess"; the web form sends literal text only.
      const text = answer.trim();
      await runAnswer(dir, text === 'accept' ? 'Accept.' : text, { dryRun: false, now: now() });
      const commit = (await execFileAsync('git', ['rev-parse', '--short', 'HEAD'], { cwd: dir })).stdout.trim();
      // Best effort: a clone without a remote (or offline) keeps the commit and the loop pulls it later.
      return { commit, pushed: await pushQuietly(dir) };
    },
    control: {
      pause: async (id, reason) => {
        const dir = await loopDir(id);
        if (dir === undefined) return undefined;
        const { changed, by, pushed, pushError } = await exclusive(dir, () => runPause(dir, reason === undefined ? {} : { reason }));
        return { changed, ...(by !== undefined && { by }), ...(pushed !== undefined && { pushed }), ...(pushError !== undefined && { pushError }) };
      },
      resume: async (id) => {
        const dir = await loopDir(id);
        if (dir === undefined) return undefined;
        const { changed, pushed, pushError } = await exclusive(dir, () => runResume(dir));
        return { changed, ...(pushed !== undefined && { pushed }), ...(pushError !== undefined && { pushError }) };
      },
      nextRound: async (id, brief) => {
        const dir = await loopDir(id);
        if (dir === undefined) return undefined;
        // The brief lands where the web buttons put it; runLaneRound archives and deletes it.
        const briefFile = path.join(dir, '.ai', 'next-round.md');
        await writeFile(briefFile, brief.endsWith('\n') ? brief : `${brief}\n`);
        // A failed round must not leave the brief behind for a lane's `git add -A`.
        const { committed } = await exclusive(dir, () => runLaneRound(dir, { briefFile, dryRun: false, commit: true, now: now() })).finally(() => rm(briefFile, { force: true }));
        const pushed = committed ? await pushQuietly(dir) : undefined;
        return { changed: true, committed, ...(pushed !== undefined && { pushed }) };
      },
      steer: async (id, lane, text, options = {}) => {
        const dir = await loopDir(id);
        if (dir === undefined) return undefined;
        const { changed, pushed, pushError } = await exclusive(dir, () => runSteer(dir, lane, text, { ...options, now: now() }));
        return { changed: changed.length > 0, lanes: changed, ...(pushed !== undefined && { pushed }), ...(pushError !== undefined && { pushError }) };
      },
      schedule: async (id, action) => {
        const dir = await loopDir(id);
        if (dir === undefined) return undefined;
        const { changed, pushed, pushError } = await exclusive(dir, () => runScheduleAction(dir, action, { now: now() }));
        return { changed: changed.length > 0, lanes: changed, ...(pushed !== undefined && { pushed }), ...(pushError !== undefined && { pushError }) };
      },
    },
    doctor: () => runDoctor(),
    checks: async () => {
      const dirs = await findLoopDirs(projectsDir);
      const perLoop = await Promise.all(dirs.map(async (dir) => checkLoop(dir, await readLoopFacts(dir), now(), undefined, await readLaneStatuses(dir, now()))));
      return perLoop.flat();
    },
  };
}
