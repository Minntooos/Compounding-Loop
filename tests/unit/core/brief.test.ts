import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { briefPasses, isVagueItem, lintBrief, listItems, MIN_BRIEF_SCORE } from '../../../src/core/brief.js';

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

describe('lintBrief heading handling', () => {
  it('does not match "Non-goals" as a goal or "Whole thing" as an audience', () => {
    const ids = lintBrief('## Non-goals\nNothing sold here at all, ever.\n## Whole thing\nSome long enough text about it.').gaps.map((g) => g.id);
    expect(ids).toContain('one-line');
    expect(ids).toContain('audience');
  });
  it('does not read "Out of scope" as the must-haves', () => {
    const reordered = good.replace(/## Out of scope[\s\S]*?\n\nExtra/, 'Extra') + '\n## Out of scope\nAccounts, payments and a backend are not built.\n';
    expect(lintBrief(reordered).score).toBe(100);
  });
  it('counts bullets under sub-headings', () => {
    const nested = good.replace(/## Must have[\s\S]*?## Done when/, '## Must have\n### Core\n- Twenty pages in `sitemap.xml`\n- 90+ Lighthouse score\n- `/about` with 3 sources\n\n## Done when');
    expect(lintBrief(nested).score).toBe(100);
  });
  it('reads bold labels as headings', () => {
    const labels = '**Goal:** A static site of twenty mortgage calculators.\n**Users:** First-time home buyers in the US.\n';
    expect(lintBrief(labels).gaps.map((g) => g.id)).not.toContain('one-line');
    expect(lintBrief(labels).gaps.map((g) => g.id)).not.toContain('audience');
  });
  it('does not accept "tests someday" as checkable', () => {
    expect(lintBrief(good.replace(/## Done when[\s\S]*?## Out/, '## Done when\nHas tests someday.\n\n## Out')).gaps.map((g) => g.id)).toEqual(['done-when']);
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

describe('round briefs (A9)', () => {
  const roundBrief = `## Round 5 (current): 0.5.0 "Cockpit" — see everything

**What we are building:** a CLI, a local dashboard and templates that run unattended, verified Claude Code build loops. **Audience:** solo developers and small teams who run Claude Code loops from scheduled routines.

### A. P0 bugs (each needs a test that fails before the fix)
1. The release stays "waiting on you" after the tag \`v0.4.0\` exists; read npm \`latest\`.
2. Phantom "no run recorded" slots: none after root \`DONE.md\` or while \`.ai/PAUSED\` exists.
3. Health shows OK for checks never measured: three states, not four.

### B. Schedule and steering
1. \`loop schedule show|pause|resume\` with \`--json\` output.
2. \`loop steer <lane> "<text>"\` writes an entry and commits.

### Round 5 done when
- \`npm test\` passes on a clean clone.
- Every A bug has a regression test in \`tests/unit\`.

**Out of scope (later rounds):**
- Hosted backend, accounts, analytics.
`;
  it('scores a brief with bold lead-ins, lettered must-have lists and a "Round N done when" heading', () => {
    const lint = lintBrief(roundBrief);
    expect(lint.gaps.map((g) => g.id)).not.toEqual(expect.arrayContaining(['audience', 'one-line', 'must-haves', 'done-when', 'out-of-scope']));
    expect(lint.score).toBeGreaterThanOrEqual(85);
  });
  it('reads two bold labels on one line', () => {
    const lint = lintBrief('**What we are building:** a thing that does useful work for people. **Audience:** solo developers who ship small tools.');
    expect(lint.gaps.map((g) => g.id)).not.toContain('one-line');
    expect(lint.gaps.map((g) => g.id)).not.toContain('audience');
  });
  it('still flags a brief with none of it', () => {
    expect(lintBrief('Build me an app.').score).toBeLessThan(MIN_BRIEF_SCORE);
  });
});
