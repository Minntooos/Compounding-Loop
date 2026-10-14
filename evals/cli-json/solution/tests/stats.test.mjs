import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { noteStats } from '../src/notes.js';

test('noteStats counts notes and words', () => {
  const dir = mkdtempSync(join(tmpdir(), 'stats-'));
  try {
    assert.deepEqual(noteStats(dir), { notes: 0, words: 0 });
    writeFileSync(join(dir, 'a.txt'), 'one two\nthree');
    writeFileSync(join(dir, 'b.md'), 'ignored words here');
    assert.deepEqual(noteStats(dir), { notes: 1, words: 3 });
  } finally {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
  }
});
