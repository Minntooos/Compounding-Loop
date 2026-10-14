// Structural checks for every page in site/. No dependencies.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SITE = 'site';
const HOST = 'https://example.com';
const errors = [];

const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
const pages = walk(SITE).filter((f) => f.endsWith('.html'));
const sitemap = readFileSync(join(SITE, 'sitemap.xml'), 'utf8');

for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  const path = '/' + relative(SITE, page).split(sep).join('/').replace(/index\.html$/, '');
  const fail = (m) => errors.push(`${path}: ${m}`);
  const description = /<meta name="description" content="([^"]*)"/.exec(html)?.[1];
  if (!description) fail('no meta description. Add <meta name="description" content="...">.');
  else if (description.length > 160) fail(`meta description is ${description.length} characters; keep it to 160.`);
  if (!html.includes(`<link rel="canonical" href="${HOST}${path}">`)) fail(`canonical must be ${HOST}${path}.`);
  if ((html.match(/<h1[ >]/g) ?? []).length !== 1) fail('needs exactly one <h1>.');
  if (/<script(?![^>]*\bsrc=)[^>]*>/.test(html)) fail('inline <script>; use an external module (the CSP forbids inline).');
  if (!sitemap.includes(`<loc>${HOST}${path}</loc>`)) fail('missing from site/sitemap.xml.');
  const words = html.replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  if (words < 120) fail(`only ${words} visible words; write at least 120.`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`check: ${pages.length} pages OK`);
