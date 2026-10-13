import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.join(__dirname, '..', '..', '..');
const read = (file: string): string => readFileSync(path.join(root, file), 'utf8');
const markdown = [
  'README.md',
  'CHANGELOG.md',
  ...readdirSync(path.join(root, 'docs')).filter((f) => f.endsWith('.md')).map((f) => `docs/${f}`),
];

describe('relative links in the docs', () => {
  it.each(markdown)('%s points only at files that exist', (file) => {
    const links = [...read(file).matchAll(/\]\((?!https?:|#|mailto:)([^)#\s]+)/g)].map((m) => m[1] ?? '');
    const dir = path.dirname(path.join(root, file));
    const missing = links.filter((l) => !existsSync(path.resolve(dir, l)));
    expect(missing).toEqual([]);
  });
});

describe('commands named in the docs', () => {
  const help = execFileSync(process.execPath, ['--import', 'tsx', path.join(root, 'src', 'cli', 'index.ts'), '--help'], { encoding: 'utf8', cwd: root });
  const known = new Set([...help.matchAll(/^ {2}([a-z][a-z-]*)\b/gm)].map((m) => m[1]));

  it.each(markdown)('%s runs only subcommands that `loop --help` lists', (file) => {
    const named = [...read(file).matchAll(/npx compounding-loop ([a-z][a-z-]*)/g)].map((m) => m[1]);
    expect(named.filter((c) => !known.has(c))).toEqual([]);
  });
});
