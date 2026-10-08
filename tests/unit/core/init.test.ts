import { describe, expect, it } from 'vitest';
import { briefBlocker, CARD_END, CARD_START, mergeCard, planInit } from '../../../src/core/init.js';

describe('mergeCard', () => {
  it('creates the file when absent or blank', () => {
    expect(mergeCard(undefined, 'CARD')).toBe(`${CARD_START}\nCARD\n${CARD_END}\n`);
    expect(mergeCard('  \n', 'CARD')).toBe(`${CARD_START}\nCARD\n${CARD_END}\n`);
  });
  it('appends after user content, keeping it', () => {
    expect(mergeCard('# Mine\n', 'CARD')).toBe(`# Mine\n\n${CARD_START}\nCARD\n${CARD_END}\n`);
  });
  it('is idempotent and replaces only the marked block', () => {
    const once = mergeCard('# Mine\n', 'CARD');
    expect(mergeCard(once, 'CARD')).toBe(once);
    expect(mergeCard(`${once}\n## After\n`, 'NEW')).toBe(`# Mine\n\n${CARD_START}\nNEW\n${CARD_END}\n\n## After\n`);
  });
});

describe('mergeCard broken markers', () => {
  it('throws on an orphan marker', () => {
    expect(() => mergeCard(`${CARD_START}\nold`, 'CARD')).toThrow(/broken/);
    expect(() => mergeCard(`${CARD_END}\n${CARD_START}`, 'CARD')).toThrow(/broken/);
  });
});

describe('briefBlocker', () => {
  it('blocks a missing or weak brief and names gaps', () => {
    expect(briefBlocker(undefined)).toMatch(/IDEA.md is missing/);
    expect(briefBlocker('# x')).toMatch(/scores 0\/100[\s\S]*audience/);
  });
});

describe('planInit', () => {
  const kit = [{ dest: '.ai/log.md', content: 'LOG' }];
  const base = { kit, card: 'CARD', existing: new Map<string, string>(), force: false };

  it('creates everything in an empty repo', () => {
    expect(planInit(base).map((a) => `${a.kind}:${a.dest}`)).toEqual(['create:.ai/log.md', 'create:CLAUDE.md', 'create:AGENTS.md']);
  });
  it('does not overwrite user files without force, and does with it', () => {
    const existing = new Map([['.ai/log.md', 'MINE'], ['AGENTS.md', 'MINE']]);
    expect(planInit({ ...base, existing })[0]).toMatchObject({ kind: 'skip' });
    expect(planInit({ ...base, existing, force: true })[0]).toMatchObject({ kind: 'overwrite', content: 'LOG' });
    expect(planInit({ ...base, existing, force: true }).find((a) => a.dest === 'AGENTS.md')?.kind).toBe('skip');
  });
  it('never overwrites loop state, even with force', () => {
    const existing = new Map([['.ai/log.md', 'MINE']]);
    const plan = planInit({ ...base, kit: [{ dest: '.ai/log.md', content: 'LOG', keep: true }], existing, force: true });
    expect(plan[0]).toMatchObject({ kind: 'skip', reason: 'loop state, never overwritten' });
  });
  it('is a no-op the second time', () => {
    const first = planInit(base);
    const existing = new Map(first.flatMap((a) => (a.content === undefined ? [] : [[a.dest, a.content] as [string, string]])));
    expect(planInit({ ...base, existing }).every((a) => a.kind === 'skip')).toBe(true);
  });
  it('skips CLAUDE.md when the kit has no card yet', () => {
    expect(planInit({ ...base, card: undefined }).some((a) => a.dest === 'CLAUDE.md')).toBe(false);
  });
});
