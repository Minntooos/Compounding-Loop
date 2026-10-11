import { describe, expect, it } from 'vitest';
import { commitsPerDay, dayHeading, groupByDay, laneColor, laneOfCommit, lanesIn, timeUtc } from '../../../web/src/lib/timeline.js';

const c = (message: string, at: string) => ({ sha: 'abcdef1234', at, message });

describe('timeline helpers', () => {
  it('reads the lane from the subject prefix', () => {
    expect(laneOfCommit('web: fleet cards')).toBe('web');
    expect(laneOfCommit('control room: product DONE')).toBe('control');
    expect(laneOfCommit('control: tidy')).toBe('control');
    expect(laneOfCommit('webinar: x')).toBe('other');
    expect(laneOfCommit('Release 0.1.0')).toBe('other');
    expect(laneOfCommit('web fix')).toBe('other');
  });
  it('colours known lanes and falls back to the quiet token', () => {
    expect(laneColor('kit')).toBe('var(--lane-kit)');
    expect(laneColor('control')).toBe('var(--lane-other)');
  });
  it('groups newest-first commits by UTC day', () => {
    const groups = groupByDay([c('a', '2026-10-11T10:00:00Z'), c('b', '2026-10-11T08:00:00Z'), c('c', '2026-10-10T23:59:00Z')]);
    expect(groups.map((g) => [g.day, g.commits.length])).toEqual([['2026-10-11', 2], ['2026-10-10', 1]]);
  });
  it('formats headings and times in UTC', () => {
    expect(dayHeading('2026-10-11')).toBe('Sun 11 Oct');
    expect(timeUtc('2026-10-11T14:05:33Z')).toBe('14:05 UTC');
  });
  it('lists the lanes present in a fixed order', () => {
    expect(lanesIn([c('web: x', '2026-10-11T10:00:00Z'), c('core: y', '2026-10-11T10:00:00Z'), c('misc', '2026-10-11T10:00:00Z')])).toEqual(['core', 'web', 'other']);
  });
  it('counts commits per day and fills the gaps', () => {
    expect(commitsPerDay([])).toEqual([]);
    expect(commitsPerDay([c('a', '2026-10-11T10:00:00Z'), c('b', '2026-10-09T08:00:00Z'), c('c', '2026-10-09T09:00:00Z')])).toEqual([
      { day: '2026-10-09', count: 2 }, { day: '2026-10-10', count: 0 }, { day: '2026-10-11', count: 1 },
    ]);
  });
  it('keeps only the newest days and skips malformed dates', () => {
    const out = commitsPerDay([c('a', '2026-10-11T10:00:00Z'), c('b', '2020-01-01T10:00:00Z'), c('x', 'bad')], 3);
    expect(out.map((d) => d.day)).toEqual(['2026-10-09', '2026-10-10', '2026-10-11']);
  });
});
