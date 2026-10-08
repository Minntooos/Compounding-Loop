// Fast structural, SEO, quality and security checks for everything in site/. No dependencies, no browser.
// Every failure message says how to fix it, because the agent reads them at exactly the right moment.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, resolve, sep, basename } from 'node:path';

const SITE = resolve(process.argv[2] ?? 'site');
const ROOT = dirname(SITE);
const MIN_WORDS = 300; // visible words per page; thin pages don't rank and invite "scaled content" penalties
const MAX_SIMILARITY = 0.6; // share of 5-word phrases two pages may have in common
const errors = [];
const fail = (file, msg) => errors.push(`${file}: ${msg}`);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

if (!existsSync(SITE)) {
  console.error(`No ${SITE} folder. Put every public file in site/ (Vercel publishes only that folder).`);
  process.exit(1);
}

const files = walk(SITE);
const rel = (p) => relative(SITE, p).split(sep).join('/');
const pages = files.filter((f) => f.endsWith('.html'));

// Private files must never be published.
for (const f of files) {
  if (/(^|\/)(CLAUDE\.md|IDEA\.md|DONE\.md|BLOCKED\.md|\.ai\/|\.env)/.test(rel(f))) {
    fail(rel(f), 'private file inside site/. Move it out: site/ is served publicly.');
  }
}

// Secrets must never be committed anywhere public.
const SECRET = /(\bsk-(ant-)?[A-Za-z0-9_-]{20,}|\bAKIA[0-9A-Z]{16}|\bAIza[0-9A-Za-z_-]{35}|\bgh[pousr]_[A-Za-z0-9]{30,}|\bxox[baprs]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/;
for (const f of files) {
  if (!/\.(html|js|mjs|css|json|txt|xml|svg|webmanifest)$/.test(f)) continue;
  if (SECRET.test(readFileSync(f, 'utf8'))) fail(rel(f), 'looks like it contains an API key or private key. Remove it; secrets never go in site/.');
}

if (pages.length === 0) fail('site/', 'no HTML pages. Build site/index.html first.');

const canonicals = [];
const titles = new Map();
const shingles = new Map();

const visibleText = (html) =>
  html
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .toLowerCase()
    .split(/[^a-z0-9%°]+/)
    .filter(Boolean);

for (const page of pages) {
  const name = rel(page);
  const html = readFileSync(page, 'utf8');
  const one = (re) => html.match(re)?.[1]?.trim();
  const isErrorPage = /^404\.html$/.test(name);

  if (!/<html[^>]*\slang="[a-z-]+"/i.test(html)) fail(name, 'add a lang attribute: <html lang="en">.');
  if (!/<meta[^>]+name="viewport"/i.test(html)) fail(name, 'add <meta name="viewport" content="width=device-width, initial-scale=1">.');

  const title = one(/<title>([^<]*)<\/title>/i);
  if (!title) fail(name, 'add a <title> containing the page\'s main keyword.');
  else if (title.length < 10 || title.length > 65) fail(name, `<title> is ${title.length} chars; keep it 10–65 so Google shows it whole.`);
  else if (titles.has(title)) fail(name, `<title> duplicates ${titles.get(title)}. Each page needs its own.`);
  else titles.set(title, name);

  if (/lorem ipsum|REPLACE_ME|\bTODO\b/i.test(html)) fail(name, 'contains placeholder text (lorem ipsum, REPLACE_ME or TODO). Write the real content.');

  // Security: the CSP in vercel.json only allows same-origin scripts, so these would break in production anyway.
  for (const [tag] of html.matchAll(/<script\b[^>]*>/gi)) {
    if (/type="application\/ld\+json"/i.test(tag)) continue;
    const src = tag.match(/\ssrc="([^"]+)"/i)?.[1];
    if (!src) fail(name, 'inline <script> code. Move it to a .js file in site/ and load it with <script type="module" src="...">; the CSP blocks inline scripts.');
    else if (/^(https?:)?\/\//i.test(src)) fail(name, `third-party script "${src}". Self-host it in site/ (or leave it out); ads and analytics are the owner's call.`);
  }
  if (/<iframe\b/i.test(html)) fail(name, 'contains an <iframe>. Embeds load third-party code; leave them out.');
  if (/\son[a-z]+\s*=\s*["']/i.test(html.replace(/<script[\s\S]*?<\/script>/gi, ''))) fail(name, 'inline event handler (onclick="..." etc.). Use addEventListener in a .js file; the CSP blocks inline handlers.');

  // Internal links and assets must exist.
  for (const [, url] of html.matchAll(/(?:href|src)="([^"#?]+)[^"]*"/gi)) {
    if (/^(https?:|mailto:|tel:|data:|\/\/)/i.test(url)) continue;
    let target = url.startsWith('/') ? join(SITE, url) : join(dirname(page), url);
    if (url.endsWith('/')) target = join(target, 'index.html');
    if (!existsSync(target) && !existsSync(`${target}.html`)) fail(name, `broken link or asset "${url}". Create the file or fix the path.`);
  }

  if (isErrorPage) continue; // 404 needs no SEO tags, canonical or sitemap entry

  const desc = one(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i);
  if (!desc) fail(name, 'add <meta name="description" content="..."> (70–160 chars, written for searchers).');
  else if (desc.length < 70 || desc.length > 160) fail(name, `meta description is ${desc.length} chars; keep it 70–160.`);

  const h1s = html.match(/<h1[\s>]/gi)?.length ?? 0;
  if (h1s !== 1) fail(name, `has ${h1s} <h1> elements; use exactly one, containing the main keyword.`);

  const canonical = one(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i);
  if (!canonical) fail(name, 'add <link rel="canonical" href="https://<domain>/<path>"> with the full URL.');
  else if (!/^https:\/\//.test(canonical)) fail(name, `canonical "${canonical}" must be an absolute https:// URL.`);
  else canonicals.push(canonical);

  if (!/<script[^>]+type="application\/ld\+json"/i.test(html)) fail(name, 'add JSON-LD structured data (WebApplication, FAQPage or BreadcrumbList).');

  // Quality: enough original text, and not a near-copy of another page.
  const words = visibleText(html);
  if (words.length < MIN_WORDS) fail(name, `only ${words.length} visible words; write at least ${MIN_WORDS} (how to use it, how it's calculated, worked example, FAQ).`);
  const set = new Set();
  for (let i = 0; i + 5 <= words.length; i++) set.add(words.slice(i, i + 5).join(' '));
  shingles.set(name, set);
}

// Near-duplicate pages (the classic programmatic-SEO failure).
const named = [...shingles.entries()].filter(([, s]) => s.size > 50);
for (let i = 0; i < named.length; i++) {
  for (let j = i + 1; j < named.length; j++) {
    const [a, sa] = named[i];
    const [b, sb] = named[j];
    let shared = 0;
    for (const s of sa) if (sb.has(s)) shared++;
    const similarity = shared / Math.min(sa.size, sb.size);
    if (similarity > MAX_SIMILARITY) {
      fail(a, `${Math.round(similarity * 100)}% of its 5-word phrases also appear in ${b}. Rewrite one of them with page-specific content, or merge them into one page. Keep shared nav and footer text short so it does not dominate.`);
    }
  }
}

// One domain everywhere.
const origins = new Set(canonicals.map((c) => new URL(c).origin));
if (origins.size > 1) fail('site/', `canonicals use ${origins.size} different domains (${[...origins].join(', ')}). Use the one domain from IDEA.md everywhere.`);
// ...and it is the address in IDEA.md's Domain section (the first word under the heading).
const ideaPath = join(ROOT, 'IDEA.md');
const host = existsSync(ideaPath) ? readFileSync(ideaPath, 'utf8').match(/^## Domain[^\n]*\n+([a-z0-9_-]+(?:\.[a-z0-9_-]+)+)/im)?.[1].toLowerCase() : null;
if (host) {
  if (!host.split('.').every((l) => /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(l))) fail('IDEA.md', `the Domain "${host}" is not a valid hostname (letters, digits and hyphens only, no leading or trailing hyphen, 63 characters per part). Fix it here and in every canonical.`);
  for (const o of origins) if (o !== `https://${host}`) fail('site/', `canonicals use ${o}, but IDEA.md's Domain section says https://${host}. Use that address in every canonical, sitemap.xml and robots.txt.`);
  const robots = existsSync(join(SITE, 'robots.txt')) ? readFileSync(join(SITE, 'robots.txt'), 'utf8') : '';
  if (robots && !robots.includes(`Sitemap: https://${host}/sitemap.xml`)) fail('robots.txt', `its Sitemap line must be "Sitemap: https://${host}/sitemap.xml".`);
}

// Hosting: vercel.json publishes only site/ and sends the security headers.
let vercel = null;
try { vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8')); } catch { /* reported below */ }
if (!vercel) fail('vercel.json', 'missing or not valid JSON. It must set "outputDirectory": "site" and send the security headers (copy it from the starter kit).');
else {
  if (vercel.outputDirectory !== 'site') fail('vercel.json', '"outputDirectory" must be "site". Anything else publishes private files such as CLAUDE.md and IDEA.md.');
  const sent = (vercel.headers ?? []).find((r) => r.source === '/(.*)')?.headers?.map((h) => h.key) ?? [];
  for (const h of ['Content-Security-Policy', 'X-Content-Type-Options', 'Referrer-Policy', 'X-Frame-Options']) {
    if (!sent.includes(h)) fail('vercel.json', `the "/(.*)" headers rule must send ${h}.`);
  }
}

// Netlify is the live host: netlify.toml must publish only site/ and send the same CSP.
const toml = existsSync(join(ROOT, 'netlify.toml')) ? readFileSync(join(ROOT, 'netlify.toml'), 'utf8') : '';
if (!/^\s*publish\s*=\s*"site\/?"\s*$/m.test(toml)) fail('netlify.toml', 'missing, or does not set publish = "site". Anything else publishes private files such as CLAUDE.md and IDEA.md.');
else if (!toml.includes('Content-Security-Policy')) fail('netlify.toml', 'must send the same security headers as vercel.json (copy it from the starter kit).');

// Sitemap and robots.
const sitemapPath = join(SITE, 'sitemap.xml');
if (!existsSync(sitemapPath)) fail('sitemap.xml', 'missing. List every page\'s canonical URL in site/sitemap.xml.');
else {
  const sitemap = readFileSync(sitemapPath, 'utf8');
  for (const c of canonicals) if (!sitemap.includes(`<loc>${c}</loc>`)) fail('sitemap.xml', `missing <loc>${c}</loc>. Every page must be listed.`);
  for (const [, loc] of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) if (!canonicals.includes(loc)) fail('sitemap.xml', `lists ${loc}, but no page has that canonical. Remove it or fix the page's canonical.`);
}
const robotsPath = join(SITE, 'robots.txt');
if (!existsSync(robotsPath) || !/^Sitemap:\s*https:\/\//im.test(readFileSync(robotsPath, 'utf8'))) {
  fail('robots.txt', 'missing, or has no "Sitemap: https://<domain>/sitemap.xml" line.');
}

// Correctness: every calculation module has unit tests.
const libDir = join(SITE, 'js', 'lib');
if (existsSync(libDir)) {
  for (const f of walk(libDir).filter((p) => /\.m?js$/.test(p))) {
    const test = join(ROOT, 'tests', 'unit', basename(f).replace(/\.m?js$/, '.test.mjs'));
    if (!existsSync(test)) fail(rel(f), `has no unit tests. Create tests/unit/${basename(test)} with reference values from a cited source (see CLAUDE.md "Correctness").`);
  }
}

if (errors.length) {
  console.error(`check: ${errors.length} problem(s)\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`check: OK (${pages.length} page(s))`);
