// Repo invariants that tests can't see: what ships, what must never be committed, and the safety rules in CLAUDE.md.
// Lanes add checks here when a lesson is worth automating (method §11: promote lessons into checks).
import { execFileSync } from 'node:child_process';
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

if (failures.length) {
  console.error(`check: ${failures.length} problem(s)\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`check: ${files.length} files OK`);
