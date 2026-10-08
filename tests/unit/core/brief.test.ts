import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { briefPasses, isVagueItem, lintBrief, listItems } from '../../../src/core/brief.js';

const good = `# IDEA: Mortgage calculators

## One line
A static site of twenty mortgage calculators that load in under one second and rank for long-tail searches.

## Who it is for
First-time home buyers in the US who search for a payment estimate before talking to a lender.

## Must have
- Twenty calculator pages, each with its own URL listed in \`sitemap.xml\`
- Every page scores 90+ on Lighthouse performance
- A \`/about\` page with the methodology and 3 cited sources
- Works without JavaScript for the headline result

## Done when
- \`npm test\` passes
- \`node scripts/check.mjs\` reports 20 pages

## Out of scope
Accounts, payments, a backend, and any lender comparison. Nothing is sold on the site, and no tracking scripts are added.

Extra context so the brief is long enough for an unattended build: the loop should write plain HTML, keep every page small, and record each decision in its task file so the next run can continue without any memory of this one.
`;

describe('lintBrief', () => {
  it('scores a complete brief 100 with no gaps', () => {
    expect(lintBrief(good)).toEqual({ score: 100, gaps: [] });
  });

  it('names every gap in an empty-ish brief and fails it', () => {
    const lint = lintBrief('# Make a cool app\nIt should be good.');
    expect(lint.gaps.map((g) => g.id)).toEqual(['one-line', 'audience', 'must-haves', 'done-when', 'out-of-scope', 'length']);
    expect(lint.score).toBe(0);
    expect(briefPasses(lint)).toBe(false);
  });

  it('flags vague must-haves', () => {
    const vague = good.replace(/## Must have[\s\S]*?## Done when/, '## Must have\n- Nice modern design\n- Fast and good\n- Clean and robust\n\n## Done when');
    const lint = lintBrief(vague);
    expect(lint.gaps.map((g) => g.id)).toEqual(['vague-must-haves']);
    expect(lint.score).toBe(90);
    expect(briefPasses(lint)).toBe(true);
  });

  it('wants a checkable done-when', () => {
    const lint = lintBrief(good.replace(/## Done when[\s\S]*?## Out/, '## Done when\nWhen it feels right.\n\n## Out'));
    expect(lint.gaps.map((g) => g.id)).toEqual(['done-when']);
    expect(lint.score).toBe(75);
  });

  it('accepts CRLF line endings', () => {
    expect(lintBrief(good.replace(/\n/g, '\r\n')).score).toBe(100);
  });

  it('passes the real IDEA.md of this repo', () => {
    expect(briefPasses(lintBrief(readFileSync(new URL('../../../IDEA.md', import.meta.url), 'utf8')))).toBe(true);
  });
});

describe('listItems and isVagueItem', () => {
  it('reads bullets, numbers and checkboxes', () => {
    expect(listItems('- a\n* b\n1. c\n2) d\n- [x] e\ntext')).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
  it('treats short or fuzzy items without evidence as vague', () => {
    expect(isVagueItem('Looks good')).toBe(true);
    expect(isVagueItem('A modern, clean layout for everyone')).toBe(true);
    expect(isVagueItem('Twenty pages listed in `sitemap.xml`')).toBe(false);
  });
});
