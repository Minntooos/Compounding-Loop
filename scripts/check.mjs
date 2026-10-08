// Repo invariants that tests can't see: what ships, what must never be committed, and the safety rules in CLAUDE.md.
// Lanes add checks here when a lesson is worth automating (method §11: promote lessons into checks).
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync, readFileSync, statSync } from 'node:fs';

const failures = [];
const fail = (msg) => failures.push(msg);

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
  .split('\n').filter((f) => f && existsSync(f) && statSync(f).isFile());
const read = (f) => readFileSync(f, 'utf8');
const textFiles = files.filter((f) => /\.(m?[jt]sx?|json|md|html|css|ya?ml|toml|txt|svg|xml)$/.test(f));

// 1. The method's own files must exist.
const lanes = ['core', 'kit', 'server', 'web', 'docs'];
for (const f of ['CLAUDE.md', 'AGENTS.md', 'IDEA.md', 'LICENSE', '.ai/method.md', '.ai/index.md', ...lanes.map((l) => `.ai/lanes/${l}/task.md`)]) {
  if (!existsSync(f)) fail(`missing ${f}`);
}

// 2. Only the allowed paths ship to npm.
const allowedShip = new Set(['bin/', 'dist/', 'templates/', 'method/', 'runners/', 'plugin/', 'README.md', 'LICENSE']);
const pkg = JSON.parse(read('package.json'));
for (const entry of pkg.files ?? []) if (!allowedShip.has(entry)) fail(`package.json files has "${entry}", which must not ship`);
if (!pkg.files) fail('package.json needs a "files" allow-list');

// 3. No secrets anywhere in the repo.
const secretPatterns = [/sk-ant-[A-Za-z0-9_-]{10,}/, /gh[pousr]_[A-Za-z0-9]{30,}/, /AKIA[0-9A-Z]{16}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /"private_key"\s*:/];
for (const f of textFiles) {
  if (f === 'scripts/check.mjs') continue;
  const text = read(f);
  for (const p of secretPatterns) if (p.test(text)) fail(`${f}: looks like a secret (${p})`);
}

// 4. Product code: no tracking, no runtime CDN, no raw HTML injection, no shell strings.
const productCode = textFiles.filter((f) => /^(src|web\/src|web\/index\.html|bin)\b/.test(f));
const banned = [
  [/googletagmanager|google-analytics|gtag\(|posthog|mixpanel|segment\.io|plausible\.io|umami/i, 'tracking or analytics'],
  [/fonts\.googleapis|cdn\.jsdelivr|unpkg\.com|cdnjs\./, 'runtime CDN load'],
  [/dangerouslySetInnerHTML|\.innerHTML\s*=/, 'raw HTML injection'],
  [/shell:\s*true|\bexecSync\(|child_process['"]\)\.exec\(|\bexec\(\s*`/, 'shell string execution'],
];
for (const f of productCode) {
  const text = read(f);
  for (const [p, what] of banned) if (p.test(text)) fail(`${f}: ${what} (${p})`);
}

// 5. Demo data and templates must be scrubbed of personal details.
for (const f of textFiles.filter((f) => /^(demo|templates|runners|plugin)\//.test(f))) {
  const text = read(f);
  if (/[A-Za-z]:\\\\?Users\\|\/Users\/[A-Za-z]|\/home\/[a-z]/.test(text)) fail(`${f}: contains a local user path`);
  if (/[\w.+-]+@(gmail|yahoo|outlook|hotmail|proton)\.\w+/i.test(text)) fail(`${f}: contains a personal email address`);
}

// 6. README converts: install command and proof table; every relative link in README and docs/*.md resolves.
{
  const readme = read('README.md');
  if (!readme.includes('npx compounding-loop init')) fail('README.md: missing the install command `npx compounding-loop init`');
  if (!/\|\s*Site\s*\|/.test(readme)) fail('README.md: missing the proof table');
  for (const f of files.filter((f) => f === 'README.md' || /^docs\/[^/]+\.md$/.test(f))) {
    const dir = f.includes('/') ? f.slice(0, f.lastIndexOf('/')) : '.';
    for (const [, target] of read(f).matchAll(/\]\(([^)\s]+)\)/g)) {
      if (/^(https?:|mailto:|#)/.test(target)) continue;
      const path = resolve(dir, decodeURIComponent(target.split('#')[0]));
      if (!existsSync(path)) fail(`${f}: broken relative link ${target}`);
    }
  }
}

// 7. Every `loop <cmd> --flag` in README, docs and launch drafts must exist in `node bin/loop.js <cmd> --help`.
{
  const helpCache = new Map();
  const helpFor = (cmd) => {
    if (!helpCache.has(cmd)) {
      try { helpCache.set(cmd, execFileSync('node', ['bin/loop.js', cmd, '--help'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })); }
      catch { helpCache.set(cmd, null); }
    }
    return helpCache.get(cmd);
  };
  const docFiles = files.filter((f) => f === 'README.md' || /^(docs|launch)\/[^/]+\.md$/.test(f));
  for (const f of docFiles) {
    for (const [, cmd, rest] of read(f).matchAll(/\b(?:compounding-loop|loop) ([a-z][a-z-]*)((?: +[^\s`|&;#]+)*)/g)) {
      const flags = [...rest.matchAll(/(?:^| )(--[a-z][a-z-]*)/g)].map((m) => m[1]);
      if (flags.length === 0) continue;
      const help = helpFor(cmd);
      if (help === null) { fail(`${f}: \`loop ${cmd}\` is not a command`); continue; }
      for (const flag of flags) if (!new RegExp(`(^|[\\s,])${flag}(?![a-z-])`).test(help)) fail(`${f}: \`loop ${cmd} ${flag}\` is not in \`loop ${cmd} --help\``);
    }
  }
}

if (failures.length) {
  console.error(`check: ${failures.length} problem(s)\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`check: ${files.length} files OK`);
