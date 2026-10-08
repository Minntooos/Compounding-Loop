// Builds demo/five-sites.json from the raw reports in .ai/reference/five-sites/.
// The raw reports contain routine ids and local details, so everything is scrubbed:
// no emails, no local paths, no key paths, no session ids. Numbers are copied unchanged.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const LOCAL_PATH = /(?:~\/[^\s"'`)]*|[^\s"'`]*\.claude\/[^\s"'`)]*|\/(?:home|Users|root|tmp)\/[^\s"'`)]*|[A-Za-z]:\\[^\s"'`)]*)/g;
const KEY_PATH = /[^\s"'`]*(?:\.pem|\.key|id_rsa|id_ed25519)\b/g;
const SESSION_ID = /\b(?:session|trig|env|cse)_[A-Za-z0-9]{6,}\b/g;
const TOKEN = /\b(?:ghp|gho|ghs|github_pat|sk)[-_][A-Za-z0-9_]{10,}\b/g;

/** Removes anything personal or machine-specific from one string. */
export function scrubText(text) {
  return text
    .replace(EMAIL, '[email removed]')
    .replace(KEY_PATH, '[key path removed]')
    .replace(LOCAL_PATH, '[path removed]')
    .replace(SESSION_ID, '[id removed]')
    .replace(TOKEN, '[token removed]');
}

/** Turns one raw report into the API's LoopDetail shape. */
export function toLoopDetail(raw) {
  const commits = raw.commits.map((c) => ({ sha: c.sha, at: c.at, message: scrubText(c.msg) }));
  const failed = raw.tests.unitFailed + raw.tests.browserFailed;
  const finished = raw.status === 'finished';
  return {
    id: raw.id,
    name: raw.domain,
    url: `https://${raw.domain}`,
    state: finished ? 'done' : 'building',
    reason: finished ? `all ${raw.maxRounds} rounds done` : `round ${raw.round} of ${raw.maxRounds}`,
    round: raw.round,
    roundsTotal: raw.maxRounds,
    run: raw.run,
    runLimit: raw.runLimit,
    tests: { passed: raw.tests.unitPassed + raw.tests.browserPassed, failed, at: raw.tests.ranAt },
    live: { ok: raw.live.live, status: raw.live.status, leaked: raw.live.leaked },
    pages: raw.pages.length,
    lastCommit: commits[0],
    timeline: commits,
    contract: raw.mustHave.map((text) => ({ text: scrubText(text), pass: finished })),
    knowledge: raw.confirmed.map(scrubText),
    decisions: raw.decisions.map(scrubText),
    history: raw.history.map((h) => ({ at: h.at, pages: h.pages })),
  };
}

/** Health checks the demo can prove from the report alone. */
export function toChecks(raw) {
  const failed = raw.tests.unitFailed + raw.tests.browserFailed;
  return [
    {
      loopId: raw.id,
      kind: 'leak',
      ok: raw.live.leaked.length === 0,
      reason: raw.live.leaked.length === 0 ? 'no leaked strings on the live site' : `${raw.live.leaked.length} leaked strings`,
      proof: `GET https://${raw.domain} returned ${raw.live.status}`,
    },
    {
      loopId: raw.id,
      kind: 'failing-tests',
      ok: failed === 0,
      reason: failed === 0 ? 'all tests pass' : `${failed} tests fail`,
      proof: `${raw.tests.unitPassed} unit and ${raw.tests.browserPassed} browser tests passed`,
    },
  ];
}

export async function buildDemo(referenceDir) {
  const files = (await readdir(referenceDir)).filter((f) => f.endsWith('.json')).sort();
  const raws = await Promise.all(files.map(async (f) => JSON.parse(await readFile(path.join(referenceDir, f), 'utf8'))));
  const generatedAt = raws.map((r) => r.collectedAt).sort().at(-1);
  return { generatedAt, loops: raws.map(toLoopDetail), inbox: [], checks: raws.flatMap(toChecks) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const snapshot = await buildDemo(path.join(root, '.ai', 'reference', 'five-sites'));
  await writeFile(path.join(root, 'demo', 'five-sites.json'), `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`wrote demo/five-sites.json (${snapshot.loops.length} loops)`);
}
