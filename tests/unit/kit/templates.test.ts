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
    for (const entry of ['node_modules/', '.env*', '.ai/runs.jsonl', '.ai/last-test.json', '.ai/session.lock']) {
      expect(lines).toContain(entry);
    }
  });
});
