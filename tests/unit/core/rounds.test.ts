import { describe, expect, it } from 'vitest';
import { buildNextRoundTask, extractNextItems, nextDoneFileName } from '../../../src/core/rounds.js';

const done = `# DONE

## What was built
- a thing

## The 10 best next improvements, ranked
1. Add search
2. Faster build
3. [ ] Dark mode

## Anything unsure
- x
`;

describe('extractNextItems', () => {
  it('reads the list under the next-N heading and stops at the next heading', () => {
    expect(extractNextItems(done)).toEqual(['Add search', 'Faster build', 'Dark mode']);
  });
  it('finds "Next 10 improvements"', () => {
    expect(extractNextItems(done.replace('The 10 best next improvements, ranked', 'Next 10 improvements'))).toEqual(['Add search', 'Faster build', 'Dark mode']);
  });
  it('accepts other "next" headings and stops at a sub-heading', () => {
    expect(extractNextItems('## Ten best next pages\n- A\n- B\n### Notes\n- x\n')).toEqual(['A', 'B']);
    expect(extractNextItems('## Next steps\n1. Do it\n')).toEqual(['Do it']);
  });
  it('returns [] without such a heading', () => {
    expect(extractNextItems('# DONE\n- x')).toEqual([]);
  });
});

describe('nextDoneFileName', () => {
  it('uses max + 1 so gaps never collide', () => {
    expect(nextDoneFileName([])).toBe('done-v1.md');
    expect(nextDoneFileName(['done-v1.md', 'done-v3.md', 'task.md'])).toBe('done-v4.md');
  });
});

describe('buildNextRoundTask', () => {
  it('writes a fresh run counter and numbered units', () => {
    const task = buildNextRoundTask(['A', 'B'], 2, 40);
    expect(task).toContain('Run: 0 / 40');
    expect(task).toContain('# TASK: Round 2');
    expect(task).toContain('1. A\n2. B');
  });
});
