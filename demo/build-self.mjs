// Builds demo/this-repo.json: the sixth demo loop, "compounding-loop (this repo)", from rounds 1 and 2 of this
// repository's history (pinned at the 0.2.0 release commit, so the output never changes). It keeps only commit
// hashes, dates and subjects plus the lane files' run counters: no author names or emails, no paths.
import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { scrubText } from './build-demo.mjs';

const execFileAsync = promisify(execFile);
export const ROUND_ONE_COMMIT = '3385cdf';
export const ROUND_TWO_COMMIT = '084bb9f';
export const TIMELINE_LENGTH = 100;
export const ROUND_ONE_LANES = ['core', 'kit', 'server', 'web', 'docs'];

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

export async function buildSelf(repoDir) {
  const log = await git(repoDir, 'log', `-${TIMELINE_LENGTH}`, '--format=%h%x1f%cI%x1f%s%x1f%b%x1e', ROUND_TWO_COMMIT);
  const commits = log.split('\x1e').map((r) => r.trim()).filter(Boolean).map((r) => {
    const [sha, at, subject, body = ''] = r.split('\x1f');
    return { sha, at: new Date(at).toISOString(), message: scrubText(subject), lane: laneOfCommit(subject, body) };
  });
  const lanes = [];
  for (const name of ROUND_ONE_LANES) {
    // Total effort over both rounds: round 1's counter lives in done-v1, round 2's in the task file.
    const [one, two] = await Promise.all([
      git(repoDir, 'show', `${ROUND_ONE_COMMIT}:.ai/lanes/${name}/task.md`).then(parseRun),
      git(repoDir, 'show', `${ROUND_TWO_COMMIT}:.ai/lanes/${name}/task.md`).then(parseRun),
    ]);
    const last = commits.find((c) => c.lane === name);
    lanes.push({
      name,
      state: 'done',
      run: one.run + two.run,
      limit: one.limit + two.limit,
      ...(last && { lastCommit: { sha: last.sha, subject: last.message, at: last.at } }),
      locked: false,
      unanswered: [],
    });
  }
  const timeline = commits.map(({ sha, at, message }) => ({ sha, at, message }));
  const run = lanes.reduce((n, l) => n + l.run, 0);
  const runLimit = lanes.reduce((n, l) => n + l.limit, 0);
  const detail = {
    id: 'compounding-loop',
    name: 'compounding-loop (this repo)',
    url: 'https://github.com/Minntooos/Compounding-Loop',
    state: 'done',
    reason: 'rounds 1 and 2 built unattended by five parallel lanes, all done; round 3 is running now',
    round: 2,
    roundsTotal: 3,
    run,
    runLimit,
    lastCommit: timeline[0],
    lanes,
    timeline,
    contract: lanes.map((l) => ({ text: `${l.name} lane: every done-when passes`, pass: true })),
    knowledge: [],
    decisions: [],
    history: [],
  };
  const checks = [{ loopId: detail.id, kind: 'failing-tests', ok: true, reason: 'all tests pass', proof: `npm test was green at ${ROUND_TWO_COMMIT}` }];
  return { loop: detail, checks };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const built = await buildSelf(root);
  await writeFile(path.join(root, 'demo', 'this-repo.json'), `${JSON.stringify(built, null, 2)}\n`);
  console.log(`wrote demo/this-repo.json (${built.loop.timeline.length} commits, ${built.loop.lanes.length} lanes)`);
}
