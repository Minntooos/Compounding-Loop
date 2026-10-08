// Collects the live status of proj1..proj5 into JSON files that Claude pushes to the dashboard's database.
// Usage: node dashboard/collect.mjs <out_dir> [--test | --test-if-stale=HOURS]
//   --test also runs `npm test` in each project (about 40 s each) and records pass/fail counts.
//   --test-if-stale=6 runs them only when the previous result in <out_dir> is older than 6 hours,
//   and otherwise carries that result forward (used by the hourly refresh, dashboard/refresh.bat).
// It also reads Search Console (read-only scope) with the same service-account key the gsc MCP uses.
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, existsSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'projects');
const OUT = resolve(process.argv[2] ?? 'dashboard-out');
const STALE_H = Number(process.argv.find((a) => a.startsWith('--test-if-stale='))?.split('=')[1] ?? NaN);
const FORCE_TESTS = process.argv.includes('--test');
const GSC_KEY = process.env.GOOGLE_APPLICATION_CREDENTIALS || '<path to your service-account key>';

const ROUTINES = {
  proj1: { id: 'trig_01H4XjfhSgT9L7WyJuVE13jr', cron: '7 * * * *' },
  proj2: { id: 'trig_01JnuLdqZKsRLPQuBrisW4eZ', cron: '19 * * * *' },
  proj3: { id: 'trig_01Js8cQpbPozmhdqPrnDHsWQ', cron: '31 * * * *' },
  proj4: { id: 'trig_014K7NNEUy3qBovKD1xPuRE4', cron: '43 * * * *' },
  proj5: { id: 'trig_0193CBtYyPVsDmfZ7Zchoioc', cron: '55 * * * *' },
};
const MAX_ROUNDS = 5; // the control room stops a repo after v5
const LOCK_MINUTES = 90; // a routine stands down while .ai/session.lock is younger than this
// Search Console facts that the collector can't see from the repo (verified 2026-10-06; sitemaps submitted 04:48 UTC).
const SETUP = { netlify: true, address: true, gsc: true, sitemap: true };

const sh = (cmd, cwd) => execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 << 20 }).trim();
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

// "## Heading" sections of a markdown file, keyed by heading text without any "(...)" note.
function sections(md) {
  const out = {};
  let key = null;
  for (const line of md.split('\n')) {
    const h = line.match(/^##\s+(.+?)\s*(\(.*\))?\s*$/);
    if (h) { key = h[1].trim(); out[key] = []; continue; }
    if (key) out[key].push(line);
  }
  for (const k of Object.keys(out)) out[k] = out[k].join('\n').trim();
  return out;
}
const bullets = (text = '') => text.split('\n').map((l) => l.match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/)?.[1]).filter(Boolean);

function walkHtml(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkHtml(p, acc);
    else if (name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

const strip = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

function pageInfo(siteDir, file) {
  const html = readFileSync(file, 'utf8');
  const rel = relative(siteDir, file).replace(/\\/g, '/');
  const url = rel === 'index.html' ? '/' : '/' + rel.replace(/index\.html$/, '').replace(/\.html$/, '');
  const body = html.match(/<body[\s\S]*<\/body>/i)?.[0] ?? html;
  return {
    url,
    title: strip(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? ''),
    h1: strip(body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? ''),
    words: strip(body).split(' ').filter(Boolean).length,
  };
}

// Keyword table rows from IDEA.md: "| cluster | /slug/ |".
function plannedPages(idea) {
  const rows = [];
  for (const line of (sections(idea)['Target keywords'] ?? '').split('\n')) {
    const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
    if (cells.length < 2 || /^-+$/.test(cells[0]) || /keyword cluster/i.test(cells[0])) continue;
    const urls = cells[1].match(/\/[a-z0-9<>\-\/]*\/|\//gi) ?? [cells[1]];
    rows.push({ keywords: cells[0], urls: [...new Set(urls)] });
  }
  return rows;
}

function countTests(dir, pattern) {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter((f) => pattern.test(f))
    .reduce((n, f) => n + (readFileSync(join(dir, f), 'utf8').match(/^\s*test\(/gm) ?? []).length, 0);
}

function dataFiles(siteDir) {
  const dir = join(siteDir, 'data');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => {
    let entries = 0, searchVerified = 0;
    try {
      const j = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      const list = Array.isArray(j) ? j : Object.values(j).find(Array.isArray) ?? Object.values(j);
      entries = Array.isArray(list) ? list.length : 0;
      searchVerified = (JSON.stringify(j).match(/"via"\s*:\s*"search"/g) ?? []).length;
    } catch { /* malformed data shows as 0 entries */ }
    return { file: f, entries, searchVerified };
  });
}

function runTests(cwd) {
  try { sh('npm install --silent', cwd); } catch { /* keep going; npm test will report */ }
  let out = '', ok = true;
  try { out = sh('npm test 2>&1', cwd); } catch (e) { out = String(e.stdout ?? '') + String(e.stderr ?? ''); ok = false; }
  const n = (re) => Number(out.match(re)?.[1] ?? 0);
  const problems = out.match(/check: (\d+) problem/)?.[1];
  return {
    ok,
    browserPassed: n(/(\d+) passed/), browserFailed: n(/(\d+) failed/), browserSkipped: n(/(\d+) skipped/),
    unitPassed: n(/^# pass (\d+)/m), unitFailed: n(/^# fail (\d+)/m),
    checkProblems: problems ? Number(problems) : 0,
    ranAt: new Date().toISOString(),
  };
}

// ---------- Search Console (read-only) ----------
// google-auth-library comes from the npx cache of mcp-server-gsc, so nothing is installed here.
function loadGoogleAuth() {
  const base = join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx');
  if (!existsSync(base) || !existsSync(GSC_KEY)) return null;
  for (const d of readdirSync(base)) {
    const pkg = join(base, d, 'node_modules', 'google-auth-library', 'package.json');
    if (existsSync(pkg)) { try { return createRequire(pkg)('google-auth-library'); } catch { /* try the next one */ } }
  }
  return null;
}
let gscClient;
async function gscCall(method, url, body) {
  if (gscClient === undefined) {
    const lib = loadGoogleAuth();
    gscClient = lib ? await new lib.GoogleAuth({ keyFile: GSC_KEY, scopes: ['https://www.googleapis.com/auth/webmasters.readonly'] }).getClient() : null;
  }
  if (!gscClient) throw new Error('no Search Console client');
  return (await gscClient.request({ method, url, data: body, timeout: 15000 })).data;
}
const isoDay = (t) => new Date(t).toISOString().slice(0, 10);
async function searchConsole(domain) {
  const site = `https://${domain}/`;
  const enc = encodeURIComponent(site);
  const out = { checkedAt: new Date().toISOString(), property: site };
  try {
    const sm = (await gscCall('GET', `https://www.googleapis.com/webmasters/v3/sites/${enc}/sitemaps`)).sitemap ?? [];
    const m = sm.find((x) => /sitemap\.xml$/.test(x.path)) ?? sm[0];
    if (m) Object.assign(out, {
      submittedAt: m.lastSubmitted ?? null, downloadedAt: m.lastDownloaded ?? null, pending: !!m.isPending,
      submitted: m.contents?.[0]?.submitted ?? null, errors: m.errors ?? '0', warnings: m.warnings ?? '0',
    });
    // Search data lags 2-3 days; ask for the last 28 days.
    const range = { startDate: isoDay(Date.now() - 30 * 864e5), endDate: isoDay(Date.now()) };
    const sa = (body) => gscCall('POST', `https://www.googleapis.com/webmasters/v3/sites/${enc}/searchAnalytics/query`, { ...range, ...body });
    const tot = (await sa({})).rows?.[0];
    out.clicks = tot?.clicks ?? 0; out.impressions = tot?.impressions ?? 0;
    out.position = tot?.position ? Math.round(tot.position * 10) / 10 : null;
    out.pagesSeen = (await sa({ dimensions: ['page'], rowLimit: 1000 })).rows?.length ?? 0;
    out.topQueries = ((await sa({ dimensions: ['query'], rowLimit: 5 })).rows ?? []).map((r) => ({ q: r.keys[0], clicks: r.clicks, impressions: r.impressions }));
    const home = await gscCall('POST', 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', { inspectionUrl: site, siteUrl: site });
    const ir = home.inspectionResult?.indexStatusResult;
    out.home = ir ? { verdict: ir.verdict, coverage: ir.coverageState, lastCrawl: ir.lastCrawlTime ?? null } : null;
    out.ok = true;
  } catch (e) {
    out.ok = false; out.error = String(e.response?.data?.error?.message ?? e.message).slice(0, 200);
  }
  return out;
}

async function liveCheck(domain) {
  try {
    const res = await fetch(`https://${domain}/`, { signal: AbortSignal.timeout(6000), redirect: 'follow' });
    const html = await res.text();
    const live = res.ok && html.includes(`https://${domain}/`);
    // The repo's private notes must never be served (Netlify publishes only site/).
    const leaked = [];
    if (res.ok) {
      for (const path of ['/CLAUDE.md', '/IDEA.md', '/.ai/task.md', '/vercel.json', '/netlify.toml', '/site/index.html']) {
        try {
          const r = await fetch(`https://${domain}${path}`, { signal: AbortSignal.timeout(6000), redirect: 'manual' });
          if (r.status === 200) leaked.push(path);
        } catch { /* unreachable counts as not leaked */ }
      }
    }
    return { checkedAt: new Date().toISOString(), live, status: res.status, leaked };
  } catch (e) {
    return { checkedAt: new Date().toISOString(), live: false, status: 0, leaked: [] };
  }
}

mkdirSync(join(OUT, 'projects'), { recursive: true });
const summary = [];
let testsRan = false;
for (const id of Object.keys(ROUTINES)) {
  const dir = join(ROOT, id);
  const prevFile = join(OUT, 'projects', `${id}.json`);
  let prev = null;
  try { prev = existsSync(prevFile) ? JSON.parse(readFileSync(prevFile, 'utf8')) : null; } catch { /* start fresh */ }
  const testsStale = !prev?.tests?.ranAt || Date.now() - Date.parse(prev.tests.ranAt) > STALE_H * 3600000;
  const runTestsNow = FORCE_TESTS || (!Number.isNaN(STALE_H) && testsStale);
  try { sh('git pull -q --ff-only origin main', dir); } catch (e) { console.error(`${id}: pull failed: ${e.message.split('\n')[0]}`); }
  const siteDir = join(dir, 'site');
  const idea = read(join(dir, 'IDEA.md'));
  const ideaS = sections(idea);
  const task = read(join(dir, '.ai', 'task.md'));
  const taskS = sections(task);
  const done = read(join(dir, 'DONE.md'));
  const blocked = read(join(dir, 'BLOCKED.md'));
  const runM = task.match(/Run:\s*(\d+)\s*\/\s*(\d+)/);
  const hosts = (ideaS['Domain'] ?? '').match(/[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi) ?? [];
  const domain = hosts[0] ?? ''; // the address the site is built for (a free netlify.app one for now)
  const futureDomain = hosts.find((h) => !/\.(vercel|netlify)\.app$/i.test(h) && h !== domain) ?? null;

  const log = sh('git log --format=%H%x09%aI%x09%an%x09%s', dir).split('\n').filter(Boolean).map((l) => {
    const [sha, at, author, msg] = l.split('\t');
    return { sha: sha.slice(0, 7), at: new Date(at).toISOString(), author, msg };
  });
  // Pages over time: number of published pages after each commit, oldest first.
  const history = [...log].reverse().map((c) => {
    let pages = 0;
    try { pages = sh(`git ls-tree -r --name-only ${c.sha} site`, dir).split('\n').filter((f) => /index\.html$/.test(f)).length; } catch { /* no site yet */ }
    return { at: new Date(c.at).toISOString(), pages, sha: c.sha };
  });
  const builtFiles = walkHtml(siteDir).filter((f) => !/404\.html$/.test(f));
  const built = builtFiles.map((f) => pageInfo(siteDir, f)).sort((a, b) => a.url.localeCompare(b.url));
  const planned = plannedPages(idea);
  const builtUrls = new Set(built.map((p) => p.url));
  const plannedUrls = [...new Set(planned.flatMap((r) => r.urls))].filter((u) => !u.includes('<'));
  const sitemapCount = (read(join(siteDir, 'sitemap.xml')).match(/<loc>/g) ?? []).length;

  // Rounds: each finished round leaves .ai/done-vK.md (or DONE.md for the latest one).
  const aiDir = join(dir, '.ai');
  const doneFiles = existsSync(aiDir) ? readdirSync(aiDir).filter((f) => /^done-v\d+\.md$/.test(f)) : [];
  const roundsDone = doneFiles.length + (done ? 1 : 0);
  const round = Math.min(MAX_ROUNDS, done ? roundsDone : roundsDone + 1);
  const rounds = doneFiles.map((f) => Number(f.match(/\d+/)[0])).sort((a, b) => a - b).map((k) => {
    let at = null;
    try { at = sh(`git log --diff-filter=A --format=%aI -1 -- .ai/done-v${k}.md`, dir) || null; } catch { /* unknown */ }
    return { round: k, finishedAt: at ? new Date(at).toISOString() : null };
  });
  if (done) {
    let at = null;
    try { at = sh('git log --diff-filter=A --format=%aI -1 -- DONE.md', dir) || null; } catch { /* unknown */ }
    rounds.push({ round: roundsDone, finishedAt: at ? new Date(at).toISOString() : null });
  }
  // Credit-session lock: one UTC timestamp line.
  const lockText = read(join(aiDir, 'session.lock')).trim();
  const lockAt = lockText && !Number.isNaN(Date.parse(lockText)) ? new Date(lockText).toISOString() : null;
  const lockAgeMin = lockAt ? Math.round((Date.now() - Date.parse(lockAt)) / 60000) : null;
  const lock = lockAt ? { at: lockAt, ageMin: lockAgeMin, active: lockAgeMin < LOCK_MINUTES, expiresAt: new Date(Date.parse(lockAt) + LOCK_MINUTES * 60000).toISOString() } : null;

  const doc = {
    id,
    repo: `https://github.com/Minntooos/${id}`,
    domain,
    futureDomain,
    oneLiner: (ideaS['The site in one sentence'] ?? '').split('\n')[0],
    audience: bullets(ideaS["Who it's for"]),
    mustHave: bullets(ideaS['Must have']).map((b) => b.replace(/\*\*/g, '').split(/[:.]\s/)[0]).slice(0, 14),
    competitors: (ideaS['Competitors'] ?? '').replace(/\n+/g, ' '),
    monetization: (ideaS['Monetization'] ?? '').replace(/\n+/g, ' '),
    routine: { ...ROUTINES[id], url: `https://claude.ai/code/routines/${ROUTINES[id].id}` },
    // finished = all rounds done; between = a round finished and the control room starts the next one.
    status: done ? (roundsDone >= MAX_ROUNDS ? 'finished' : 'between') : blocked ? 'blocked' : runM && Number(runM[1]) === 0 ? 'waiting' : 'building',
    round, roundsDone, maxRounds: MAX_ROUNDS, rounds,
    lock,
    builder: lock?.active ? 'session' : 'routine',
    setup: SETUP,
    run: runM ? Number(runM[1]) : 0,
    runLimit: runM ? Number(runM[2]) : 30,
    blockedText: blocked.slice(0, 4000),
    doneText: done.slice(0, 8000),
    currentState: bullets(taskS['Current state']),
    decisions: bullets(taskS['Decisions']),
    tried: bullets(taskS['Tried']),
    confirmed: bullets(taskS['Confirmed']),
    pages: built,
    planned: planned.map((r) => ({ ...r, built: r.urls.some((u) => builtUrls.has(u)) })),
    plannedCount: plannedUrls.length,
    builtPlannedCount: plannedUrls.filter((u) => builtUrls.has(u)).length,
    sitemapCount,
    libs: existsSync(join(siteDir, 'js', 'lib')) ? readdirSync(join(siteDir, 'js', 'lib')).filter((f) => f.endsWith('.js')) : [],
    unitTestCount: countTests(join(dir, 'tests', 'unit'), /\.test\.mjs$/),
    browserTestCount: countTests(join(dir, 'tests'), /\.spec\.js$/),
    data: dataFiles(siteDir),
    commits: log.slice(0, 30),
    commitCount: log.length,
    lastCommitAt: log[0]?.at ?? null,
    history,
    tests: runTestsNow ? runTests(dir) : prev?.tests ?? null,
    gsc: domain ? await searchConsole(domain) : null,
    live: domain ? await liveCheck(domain) : null,
    collectedAt: new Date().toISOString(),
  };
  if (runTestsNow) testsRan = true;
  writeFileSync(prevFile, JSON.stringify(doc, null, 1));
  summary.push(`${id} ${doc.status} round ${doc.round}/${MAX_ROUNDS} (${doc.roundsDone} done) ${doc.builder} sitemap ${sitemapCount} run ${doc.run}/${doc.runLimit} pages ${built.length} planned ${doc.builtPlannedCount}/${doc.plannedCount} commits ${log.length}` +
    (doc.tests ? ` tests ${doc.tests.ok ? 'PASS' : 'FAIL'} (${doc.tests.unitPassed}u/${doc.tests.browserPassed}b)` : '') + ` live=${doc.live?.live} gsc=${doc.gsc?.ok ? `${doc.gsc.impressions}imp/${doc.gsc.pagesSeen}pages/home:${doc.gsc.home?.coverage}` : doc.gsc?.error}`);
}
writeFileSync(join(OUT, 'status.json'), JSON.stringify({ updatedAt: new Date().toISOString(), testsRun: testsRan, by: process.env.DASH_REFRESH_BY || 'Claude Code' }, null, 1));
console.log(summary.join('\n'));
