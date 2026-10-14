// Decides the calc-page eval. Copied into the working copy after the run, so the model cannot edit it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (p) => readFileSync(p, 'utf8');

test('litresNeeded matches the reference cases', async () => {
  assert.ok(existsSync('site/js/lib/paint.js'), 'site/js/lib/paint.js is missing');
  const { litresNeeded } = await import(new URL('../site/js/lib/paint.js', import.meta.url));
  assert.equal(litresNeeded(40, 10, 2), 8);
  assert.equal(litresNeeded(10, 12, 2), 2);
  assert.equal(litresNeeded(25, 10, 1), 2.5);
  assert.equal(litresNeeded(1, 100, 1), 0.5);
});

test('litresNeeded rejects impossible input', async () => {
  const { litresNeeded } = await import(new URL('../site/js/lib/paint.js', import.meta.url));
  for (const args of [[0, 10, 2], [-5, 10, 2], [10, 0, 2], [10, 10, 0], [10, 10, 1.5], [Number.NaN, 10, 1], [10, Number.POSITIVE_INFINITY, 1]]) {
    assert.throws(() => litresNeeded(...args), RangeError, `args ${args}`);
  }
});

test('the page has what search needs', () => {
  const html = read('site/paint-calculator/index.html');
  assert.match(html, /<link rel="canonical" href="https:\/\/example\.com\/paint-calculator\/">/);
  const description = /<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? '';
  assert.ok(description.length > 0 && description.length <= 160, `description is ${description.length} characters`);
  assert.equal((html.match(/<h1[ >]/g) ?? []).length, 1);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/, 'inline script');
  const words = html.replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  assert.ok(words >= 120, `only ${words} visible words`);
});

test('the page is in the sitemap and linked from the home page', () => {
  assert.ok(read('site/sitemap.xml').includes('<loc>https://example.com/paint-calculator/</loc>'));
  assert.ok(read('site/index.html').includes('href="/paint-calculator/"'));
});

test('the repo\'s own checks still pass', async () => {
  const { execFileSync } = await import('node:child_process');
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  execFileSync(npm, ['test'], { stdio: 'pipe', shell: process.platform === 'win32' });
});
