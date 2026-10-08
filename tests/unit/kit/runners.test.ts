import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (...parts: string[]): string => readFileSync(join(process.cwd(), ...parts), 'utf8');

describe('runners/routine', () => {
  const prompt = read('runners', 'routine', 'prompt.md');

  it('states the shared lock, budget and DONE/BLOCKED rules', () => {
    expect(prompt).toContain('90 minutes');
    expect(prompt).toContain('Run: N / 30');
    expect(prompt).toContain('DONE.md');
    expect(prompt).toContain('BLOCKED.md');
  });

  it('pushes to main and never to a claude/ branch', () => {
    expect(prompt).toContain('git push origin main');
    expect(prompt).toMatch(/Never create or push a `claude\/` branch/);
  });

  it('uses only the documented placeholders', () => {
    const found = new Set([...prompt.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]));
    expect([...found]).toEqual(['name']);
  });

  it('documents a staggered cron and the placeholders in the README', () => {
    const readme = read('runners', 'routine', 'README.md');
    expect(readme).toContain('{{name}}');
    expect(readme).toMatch(/\d+ \* \* \* \*/);
    expect(readme).toContain('Staggered cron');
  });
});
