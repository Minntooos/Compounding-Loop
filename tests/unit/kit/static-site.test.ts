import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { fillPlaceholders, isTextFile } from '../../../src/core/template.js';

const template = join(process.cwd(), 'templates', 'static-site');
const temps: string[] = [];

/** Mirrors what `loop new` does: copy the template, then fill `{{name}}` in text files. */
function freshCopy(name: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'cl-static-'));
  temps.push(dir);
  cpSync(template, dir, { recursive: true });
  const walk = (d: string): void => {
    for (const entry of readdirSync(d)) {
      const p = join(d, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (isTextFile(entry)) writeFileSync(p, fillPlaceholders(readFileSync(p, 'utf8'), { name }));
    }
  };
  walk(dir);
  return dir;
}

afterAll(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});

describe('templates/static-site', () => {
  it('has no niche-specific words', () => {
    const all: string[] = [];
    const walk = (d: string): void => {
      for (const e of readdirSync(d)) {
        const p = join(d, e);
        if (statSync(p).isDirectory()) walk(p);
        else if (isTextFile(e)) all.push(readFileSync(p, 'utf8'));
      }
    };
    walk(template);
    const text = all.join('\n');
    expect(text).not.toMatch(/keyspersecond|reaction time|\bKPS\b/i);
  });

  it('leaves no placeholder other than {{name}} after filling', () => {
    const dir = freshCopy('demo-site');
    const index = readFileSync(join(dir, 'site', 'index.html'), 'utf8');
    expect(index).not.toContain('{{');
    expect(index).toContain('https://demo-site.netlify.app/');
  });

  it('passes its own check script when freshly copied', () => {
    const dir = freshCopy('demo-site');
    const out = execFileSync(process.execPath, ['scripts/check.mjs'], { cwd: dir, encoding: 'utf8' });
    expect(out).toContain('check: OK');
  });

  it('rejects a Domain that is not a valid hostname (underscore project names)', () => {
    const dir = freshCopy('my_site');
    expect(() => execFileSync(process.execPath, ['scripts/check.mjs'], { cwd: dir, encoding: 'utf8', stdio: 'pipe' })).toThrow(/not a valid hostname/);
  });

  it.skipIf(!process.env.LOOP_SLOW)('passes its full npm test (slow)', () => {
    const dir = freshCopy('demo-site');
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    execFileSync(npm, ['install'], { cwd: dir, stdio: 'inherit', shell: process.platform === 'win32' });
    execFileSync(npm, ['test'], { cwd: dir, stdio: 'inherit', shell: process.platform === 'win32' });
  }, 600_000);
});
