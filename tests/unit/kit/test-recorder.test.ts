import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseTestRecord } from '../../../src/server/health.js';
// @ts-expect-error plain JS module shipped inside the templates, no types
import { countResults } from '../../../templates/static-site/scripts/test.mjs';

describe('countResults', () => {
  it('reads node:test spec and TAP totals', () => {
    expect(countResults('ℹ tests 4\nℹ pass 3\nℹ fail 1\n')).toEqual({ passed: 3, failed: 1 });
    expect(countResults('# tests 2\n# pass 2\n# fail 0\n')).toEqual({ passed: 2, failed: 0 });
  });
  it('reads Playwright totals, with colour codes', () => {
    expect(countResults('  \x1b[32m12 passed\x1b[39m (4.1s)\n  1 failed\n')).toEqual({ passed: 12, failed: 1 });
  });
  it('returns undefined when nothing is countable', () => {
    expect(countResults('All checks passed.\n')).toBeUndefined();
  });
});

describe('templates scripts/test.mjs', () => {
  let dir = '';
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('the two templates ship the same recorder', () => {
    const read = (t: string) => readFileSync(path.resolve('templates', t, 'scripts', 'test.mjs'), 'utf8');
    expect(read('chrome-extension')).toBe(read('static-site'));
  });

  it('writes .ai/last-test.json that the dashboard parses, and stops at the first failing step', () => {
    dir = mkdtempSync(path.join(tmpdir(), 'loop-rec-'));
    cpSync(path.resolve('templates/static-site/scripts/test.mjs'), path.join(dir, 'scripts', 'test.mjs'), { recursive: true });
    writeFileSync(path.join(dir, 'scripts', 'check.mjs'), 'process.exit(0);\n');
    const run = () => execFileSync(process.execPath, ['scripts/test.mjs'], { cwd: dir, stdio: 'pipe' });
    run();
    const ok = JSON.parse(readFileSync(path.join(dir, '.ai', 'last-test.json'), 'utf8')) as { at: string };
    expect(parseTestRecord(JSON.stringify(ok))).toEqual({ passed: 1, failed: 0 });
    expect(Number.isNaN(Date.parse(ok.at))).toBe(false);

    writeFileSync(path.join(dir, 'scripts', 'check.mjs'), 'process.exit(3);\n');
    expect(run).toThrow();
    expect(parseTestRecord(readFileSync(path.join(dir, '.ai', 'last-test.json'), 'utf8'))).toEqual({ passed: 0, failed: 1 });
  });
});
