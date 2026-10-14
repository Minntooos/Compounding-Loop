import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const filesIn = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? filesIn(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : []));

describe('runtime dependencies', () => {
  // The packed CLI only gets "dependencies": a package imported by src/ but listed under devDependencies fails on a clean install.
  it('every package imported by src/ is in "dependencies"', () => {
    const deps = Object.keys((JSON.parse(readFileSync('package.json', 'utf8')) as { dependencies: Record<string, string> }).dependencies);
    const used = new Set<string>();
    for (const file of filesIn('src')) {
      for (const m of readFileSync(file, 'utf8').matchAll(/(?:^|\n)\s*(?:import|export)\b[^'"\n]*?from\s+['"]([^'"]+)['"]/g)) {
        const spec = m[1] as string;
        if (spec.startsWith('.') || spec.startsWith('node:')) continue;
        used.add(spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : (spec.split('/')[0] as string));
      }
    }
    expect([...used].filter((name) => !deps.includes(name))).toEqual([]);
    expect(used.has('yaml')).toBe(true);
  });
});
