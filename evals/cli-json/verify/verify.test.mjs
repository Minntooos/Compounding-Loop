// Decides the cli-json eval. Copied into the working copy after the run, so the model cannot edit it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const bin = fileURLToPath(new URL('../bin/notes.js', import.meta.url));
const notes = (...args) => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8' });

const withDir = (files, fn) => {
  const dir = mkdtempSync(join(tmpdir(), 'notes-verify-'));
  try {
    for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
  }
};

test('stats --json prints only the JSON object', () => {
  withDir({ 'a.txt': 'one two three', 'b.txt': 'four\nfive six seven', 'c.md': 'not a note' }, (dir) => {
    const r = notes('stats', '--dir', dir, '--json');
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.stdout), { notes: 2, words: 7 });
  });
});

test('stats prints a sentence for people', () => {
  withDir({ 'a.txt': 'one two three', 'b.txt': 'four five' }, (dir) => {
    assert.equal(notes('stats', '--dir', dir).stdout.trim(), '2 notes, 5 words');
  });
  withDir({ 'a.txt': 'solo' }, (dir) => {
    assert.equal(notes('stats', '--dir', dir).stdout.trim(), '1 note, 1 word');
  });
});

test('an empty folder is not an error', () => {
  withDir({}, (dir) => {
    const r = notes('stats', '--dir', dir, '--json');
    assert.equal(r.status, 0);
    assert.deepEqual(JSON.parse(r.stdout), { notes: 0, words: 0 });
  });
});

test('a missing folder: message on stderr, nothing on stdout, exit 1', () => {
  const r = notes('stats', '--dir', join(tmpdir(), 'notes-verify-missing'), '--json');
  assert.equal(r.status, 1);
  assert.equal(r.stdout, '');
  assert.ok(r.stderr.trim().length > 0 && !r.stderr.trim().includes('\n'), 'one line on stderr');
});

test('--help lists stats', () => {
  assert.match(notes('--help').stdout, /stats/);
});

test('the repo\'s own tests pass', () => {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  execFileSync(npm, ['test'], { stdio: 'pipe', shell: process.platform === 'win32' });
});
