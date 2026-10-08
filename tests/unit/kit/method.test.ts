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

  it('has a Lanes chapter in Part B, before Part C, covering the rules and the failure modes seen', () => {
    const method = read('method', 'COMPOUNDING_LOOP.md');
    const start = method.indexOf('### 16. Lanes');
    expect(start).toBeGreaterThan(method.indexOf('## Part B'));
    expect(start).toBeLessThan(method.indexOf('## Part C'));
    const chapter = method.slice(start, method.indexOf('## Part C'));
    for (const needle of ['When to split into lanes', 'Do not split', 'Ownership', 'Outboxes', 'The control room', 'The trailer check', 'Lane: <lane>', 'loop check-lanes', 'git pull --ff-only', 'git pull --rebase', 'Never force-push', 'Stale sandbox clones', 'Rate-limit starvation', 'A lane waiting on a finished lane']) {
      expect(chapter, needle).toContain(needle);
    }
    expect(method).toContain('16. Lanes');
  });

  it('ships a knowledge index with an example entry that has frontmatter', () => {
    expect(read('method', 'knowledge-index.md')).not.toMatch(/^K-\d+/m);
    expect(read('method', 'example', 'K-0001.md')).toMatch(/^---\nid: K-0001\n/);
  });
});

describe('method protocol files', () => {
  it('reviewer prompt asks for the three likeliest failures and a short report', () => {
    const text = read('method', 'reviewer-prompt.md');
    expect(text).toContain('three most likely ways this is wrong');
    expect(text).toContain('BLOCKER');
  });

  it('stuck protocol ends in BLOCKED.md', () => {
    const text = read('method', 'stuck-protocol.md');
    expect(text).toContain('same failure twice');
    expect(text).toContain('BLOCKED.md');
  });

  it('retro covers the promotion ladder and deleting the task file', () => {
    const text = read('method', 'retro.md');
    expect(text).toContain('guess → confirmed note → note with a trigger → automated check');
    expect(text).toContain('Delete `.ai/task.md`');
  });
});

describe('unattended rules are identical everywhere', () => {
  const files: string[][] = [
    ['method', 'operating-card.md'],
    ['method', 'COMPOUNDING_LOOP.md'],
    ['runners', 'routine', 'prompt.md'],
    ['templates', 'static-site', '.ai', 'loop-prompt.md'],
    ['templates', 'static-site', '.ai', 'task.md'],
    ['method', 'task-template.md'],
  ];

  it.each(files)('%s carries the 30-run budget', (...parts) => {
    expect(read(...parts)).toMatch(/Run: (N|0) \/ 30/);
  });

  it.each(files.slice(0, 4))('%s carries the 90-minute lock and DONE/BLOCKED', (...parts) => {
    const text = read(...parts);
    expect(text).toMatch(/less than 90 minutes/);
    expect(text).toContain('DONE.md');
    expect(text).toContain('BLOCKED.md');
  });
});
