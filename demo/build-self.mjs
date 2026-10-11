// Builds demo/this-repo.json: the sixth demo loop, "compounding-loop (this repo)", from rounds 1 and 2 of this
// repository's history (pinned at the 0.3.0 release commit, so the output never changes). It keeps the full history
// up to the pin: commit hashes, dates, subjects and author display names, plus the lane files' run counters. No
// emails, no paths. Run it with `npx tsx demo/build-self.mjs` (it reuses the TypeScript task-file parsers). Live mode fetches only what came after the pin and merges it (src/server/live/merge.ts).
import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { laneNotesFromTask } from '../src/server/taskBullets.ts';
import { scrubText } from './build-demo.mjs';

const execFileAsync = promisify(execFile);
export const ROUND_ONE_COMMIT = '3385cdf';
export const ROUND_TWO_COMMIT = '084bb9f';
export const ROUND_THREE_COMMIT = 'b3b51a5';
/** Last commit in the snapshot; its date is `snapshotAt` and the `since` of the live fetch. */
export const SNAPSHOT_COMMIT = ROUND_THREE_COMMIT;
export const ROUND_ONE_LANES = ['core', 'kit', 'server', 'web', 'docs'];

// Git identities that are not people (an unset user.name in a sandbox); the dashboard shows no author for them.
const PLACEHOLDER_AUTHORS = new Set(['unknown', 'read']);

const git = async (cwd, ...args) => (await execFileAsync('git', args, { cwd, maxBuffer: 16 * 1024 * 1024 })).stdout;

/** `Run: N / LIMIT` from a lane's task.md. */
export function parseRun(taskText) {
  const m = /^Run:\s*(\d+)\s*\/\s*(\d+)/m.exec(taskText);
  return m ? { run: Number(m[1]), limit: Number(m[2]) } : { run: 0, limit: 0 };
}

/** The lane a commit belongs to: its `Lane:` trailer, else the `<lane>: ` subject prefix of round 1. */
export function laneOfCommit(subject, body = '') {
  const trailer = /^Lane:\s*([a-z0-9-]+)\s*$/m.exec(body)?.[1];
  const prefix = /^([a-z0-9-]+): /.exec(subject)?.[1];
  const lane = trailer ?? prefix;
  return ROUND_ONE_LANES.includes(lane) ? lane : undefined;
}

/** Lane shown for a commit: `Lane:` trailer, then subject prefix, `Release x.y.z` = release, else other (mirrors core's commitLane). */
export function commitLaneOf(subject, body = '') {
  const trailer = /^Lane:\s*([a-z0-9-]+)\s*$/m.exec(body)?.[1];
  if (trailer) return trailer;
  if (/^release\s+v?\d/i.test(subject)) return 'release';
  const prefix = /^([a-z][a-z0-9-]*)(?:\s+room)?:/i.exec(subject)?.[1]?.toLowerCase();
  return prefix && [...ROUND_ONE_LANES, 'control', 'release'].includes(prefix) ? prefix : 'other';
}

export async function buildSelf(repoDir) {
  const log = await git(repoDir, 'log', '--abbrev=7', '--format=%h%x1f%cI%x1f%an%x1f%s%x1f%b%x1e', SNAPSHOT_COMMIT);
  const commits = log.split('\x1e').map((r) => r.trim()).filter(Boolean).map((r) => {
    const [sha, at, name, subject, body = ''] = r.split('\x1f');
    const author = scrubText(name.trim());
    const named = author && !author.includes('@') && !PLACEHOLDER_AUTHORS.has(author.toLowerCase());
    return { sha, at: new Date(at).toISOString(), message: scrubText(subject), ...(named && { author }), lane: laneOfCommit(subject, body), shown: commitLaneOf(subject, body) };
  });
  const lanes = [];
  const laneTexts = new Map();
  for (const name of ROUND_ONE_LANES) {
    // Total effort over all rounds: each round's counter is the lane's task.md at that round's last commit.
    const [oneText, twoText, threeText] = await Promise.all(
      [ROUND_ONE_COMMIT, ROUND_TWO_COMMIT, ROUND_THREE_COMMIT].map((commit) => git(repoDir, 'show', `${commit}:.ai/lanes/${name}/task.md`)),
    );
    const [one, two, three] = [oneText, twoText, threeText].map(parseRun);
    laneTexts.set(name, threeText);
    const last = commits.find((c) => c.lane === name);
    lanes.push({
      name,
      state: 'done',
      run: one.run + two.run + three.run,
      limit: one.limit + two.limit + three.limit,
      ...(last && { lastCommit: { sha: last.sha, subject: last.message, at: last.at } }),
      locked: false,
      unanswered: [],
    });
  }
  const timeline = commits.map(({ sha, at, message, author, shown }) => ({ sha, at, message, ...(author && { author }), lane: shown }));
  const run = lanes.reduce((n, l) => n + l.run, 0);
  const runLimit = lanes.reduce((n, l) => n + l.limit, 0);
  const detail = {
    id: 'compounding-loop',
    name: 'compounding-loop (this repo)',
    url: 'https://github.com/Minntooos/Compounding-Loop',
    state: 'done',
    reason: 'rounds 1 to 3 built unattended by five parallel lanes, all done; round 4 is running now',
    round: 3,
    roundsTotal: 4,
    run,
    runLimit,
    lastCommit: timeline[0],
    snapshotAt: timeline[0].at,
    lanes,
    timeline,
    contract: lanes.map((l) => ({ text: `${l.name} lane: every done-when passes`, pass: true })),
    laneNotes: ROUND_ONE_LANES.map((name) => laneNotesFromTask(name, scrubText(laneTexts.get(name) ?? ''), true)),
    knowledge: [],
    decisions: [],
    history: [],
  };
  const checks = [{ loopId: detail.id, kind: 'failing-tests', ok: true, reason: 'all tests pass', proof: `npm test was green at ${SNAPSHOT_COMMIT}` }];
  return { loop: detail, checks };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const built = await buildSelf(root);
  await writeFile(path.join(root, 'demo', 'this-repo.json'), `${JSON.stringify(built, null, 2)}\n`);
  console.log(`wrote demo/this-repo.json (${built.loop.timeline.length} commits, ${built.loop.lanes.length} lanes)`);
}
