import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (...parts: string[]): string => readFileSync(join(root, ...parts), 'utf8');

describe('method/operating-card.md', () => {
  const card = read('method', 'operating-card.md');

  it('stays under 60 lines', () => {
    expect(card.trimEnd().split('\n').length).toBeLessThan(60);
  });

  it('states the unattended rules with the shared numbers', () => {
    expect(card).toContain('90 minutes');
    expect(card).toContain('Run: N / 30');
    expect(card).toContain('DONE.md');
    expect(card).toContain('BLOCKED.md');
  });

  it('keeps the Never list', () => {
    expect(card).toContain('**Never**');
    expect(card).toContain('Mark your own work done without the checks passing');
  });
});

describe('method/task-template.md', () => {
  const template = read('method', 'task-template.md');

  it.each(['Goal', 'Done when', 'Confirmed', 'Guesses', 'Tried', 'Decisions', 'Handoff'])(
    'has a %s section or field',
    (name) => {
      expect(template).toContain(name);
    },
  );

  it('starts the run counter at 0 / 30', () => {
    expect(template).toMatch(/^Run: 0 \/ 30$/m);
  });
});

describe('method/COMPOUNDING_LOOP.md and knowledge files', () => {
  it('states the same unattended numbers as the card', () => {
    const method = read('method', 'COMPOUNDING_LOOP.md');
    expect(method).toContain('90 minutes');
    expect(method).toContain('Run: N / 30');
  });

  it('ships a knowledge index with an example entry that has frontmatter', () => {
    expect(read('method', 'knowledge-index.md')).toContain('K-0001');
    expect(read('method', 'example', 'K-0001.md')).toMatch(/^---\nid: K-0001\n/);
  });
});
