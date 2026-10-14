import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main } from '../src/cli.js';

const run = async (args) => {
  let out = '';
  let err = '';
  const code = await main(args, { out: (s) => (out += s), err: (s) => (err += s) });
  return { code, out, err };
};

test('list prints note names, and JSON with --json', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'notes-'));
  try {
    writeFileSync(join(dir, 'b.txt'), 'two words');
    writeFileSync(join(dir, 'a.txt'), 'one');
    assert.equal((await run(['list', '--dir', dir])).out, 'a.txt\nb.txt\n');
    assert.deepEqual(JSON.parse((await run(['list', '--dir', dir, '--json'])).out), { notes: [{ name: 'a.txt' }, { name: 'b.txt' }] });
  } finally {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
  }
});

test('a missing folder is an error with nothing on stdout', async () => {
  const r = await run(['list', '--dir', join(tmpdir(), 'notes-does-not-exist')]);
  assert.equal(r.code, 1);
  assert.equal(r.out, '');
  assert.match(r.err, /^notes: /);
});
