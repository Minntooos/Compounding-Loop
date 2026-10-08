import { describe, expect, it } from 'vitest';
import { addAnswerToTask, extendRunBudget, isBudgetBlock, formatAnswer, parseBlocked } from '../../../src/core/blocked.js';

const headed = '# BLOCKED\n\n## What I tried\nthings\n\n## Specific question\nShould the site use .com or .org?\n\n## Best guess\nUse .com.\n';
const bold = '**Tried:** a\n**Question:** Which licence?\n**Best guess:** MIT\n';

describe('parseBlocked', () => {
  it('reads heading sections', () => {
    expect(parseBlocked(headed)).toMatchObject({ question: 'Should the site use .com or .org?', bestGuess: 'Use .com.' });
  });
  it('reads bold labels with inline text', () => {
    expect(parseBlocked(bold)).toMatchObject({ question: 'Which licence?', bestGuess: 'MIT' });
  });
  it('falls back to the whole text as the question', () => {
    expect(parseBlocked('run budget reached')).toMatchObject({ question: 'run budget reached', bestGuess: '' });
  });
});

describe('addAnswerToTask', () => {
  const block = formatAnswer(parseBlocked(headed), ' .com ', '2026-10-08');
  it('puts the answer under Decisions', () => {
    const out = addAnswerToTask('# T\n\n## Decisions\nold\n\n## Confirmed\n', block);
    expect(out).toContain('## Decisions\n### Owner answer, 2026-10-08\nQuestion: Should the site use .com or .org?\nAnswer: .com\n');
    expect(out.indexOf('old')).toBeGreaterThan(out.indexOf('Owner answer'));
  });
  it('adds a Decisions section when missing', () => {
    expect(addAnswerToTask('# T\n', block)).toMatch(/## Decisions\n### Owner answer/);
  });
});

describe('run budget blocks', () => {
  it('detects them and raises the limit from the current run', () => {
    expect(isBudgetBlock('Run budget reached')).toBe(true);
    expect(isBudgetBlock(headed)).toBe(false);
    expect(extendRunBudget('x\nRun: 30 / 30\ny')).toBe('x\nRun: 30 / 60\ny');
    expect(extendRunBudget('no counter')).toBe('no counter');
  });
});
