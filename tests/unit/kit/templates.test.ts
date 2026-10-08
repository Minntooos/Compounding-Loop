import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe.each(['static-site', 'chrome-extension'])('templates/%s gitignore', (name) => {
  const dir = join(process.cwd(), 'templates', name);

  // npm drops `.gitignore` from tarballs; core's copyTemplate renames `gitignore` back.
  it('ships as `gitignore`, not `.gitignore`', () => {
    expect(existsSync(join(dir, 'gitignore'))).toBe(true);
    expect(existsSync(join(dir, '.gitignore'))).toBe(false);
  });

  it('ignores the files the loop writes at runtime', () => {
    const lines = readFileSync(join(dir, 'gitignore'), 'utf8').split('\n');
    for (const entry of ['node_modules/', '.env*', '.ai/runs.jsonl', '.ai/session.lock']) {
      expect(lines).toContain(entry);
    }
  });

  // The dashboard reads .ai/last-test.json from the clone, so cloud runs must be able to commit it.
  it('does not ignore .ai/last-test.json', () => {
    expect(readFileSync(join(dir, 'gitignore'), 'utf8').split('\n')).not.toContain('.ai/last-test.json');
  });

  it('npm test runs scripts/test.mjs, which records results', () => {
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    expect(pkg.scripts.test).toBe('node scripts/test.mjs');
    expect(readFileSync(join(dir, 'scripts', 'test.mjs'), 'utf8')).toContain("'last-test.json'");
  });
});
