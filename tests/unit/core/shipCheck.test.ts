import { describe, expect, it } from 'vitest';
import { parseChangelog, releaseFor } from '../../../src/core/parse/changelog.js';
import { openFindings, shipCheck, type ShipFacts } from '../../../src/core/shipCheck.js';

const CHANGELOG = `# Changelog

## [Unreleased]

## [0.4.0] - 2026-10-14

### Added
- Pause and resume
- Runs tab

### Fixed
- Commit history beyond 100

## [0.3.0] - 2026-10-11
- Direct bullet

[0.4.0]: https://example.com
`;

describe('parseChangelog', () => {
  it('reads versions, dates, sections and bullets', () => {
    const releases = parseChangelog(CHANGELOG);
    expect(releases.map((r) => [r.version, r.date])).toEqual([['Unreleased', undefined], ['0.4.0', '2026-10-14'], ['0.3.0', '2026-10-11']]);
    expect(releases[1]?.sections.map((s) => [s.title, s.items.length])).toEqual([['Added', 2], ['Fixed', 1]]);
    expect(releases[1]?.items).toEqual(['Pause and resume', 'Runs tab', 'Commit history beyond 100']);
    expect(releases[2]?.sections[0]).toEqual({ title: '', items: ['Direct bullet'] });
    expect(releases[0]?.items).toEqual([]);
  });
  it('finds a release by version, with or without v, and handles CRLF and empty input', () => {
    expect(releaseFor(parseChangelog(CHANGELOG), 'v0.3.0')?.date).toBe('2026-10-11');
    expect(releaseFor(parseChangelog(CHANGELOG.replace(/\n/g, '\r\n')), '0.4.0')?.items).toHaveLength(3);
    expect(parseChangelog('')).toEqual([]);
    expect(releaseFor([], '1.0.0')).toBeUndefined();
  });
});

describe('openFindings', () => {
  it('collects bullets under open-finding style headings only', () => {
    const done = '# Done\n\n## What was built\n- a thing\n\n## Minor findings left open\n- stale lock\n- 2nd\n\n## Anything unsure\n- none\n';
    expect(openFindings(done)).toEqual(['stale lock', '2nd', 'none']);
  });
});

describe('shipCheck', () => {
  const ready: ShipFacts = { version: '0.4.0', doneText: '# Done\n## Minor findings left open\n- none\n', changelogText: CHANGELOG, tagExists: false, treeClean: true, tests: { passed: 500, failed: 0, at: '2026-10-14T10:00:00Z' } };
  const ids = (facts: ShipFacts) => shipCheck(facts).items.filter((i) => !i.ok).map((i) => i.id);

  it('is ready when every item passes', () => {
    const r = shipCheck(ready);
    expect(r.ready).toBe(true);
    expect(r.items.map((i) => i.id)).toEqual(['done', 'findings', 'changelog', 'tag', 'clean', 'tests']);
    expect(r.openFindings).toEqual([]);
  });
  it('fails on each missing fact', () => {
    expect(ids({ ...ready, doneText: undefined })).toEqual(['done']);
    expect(ids({ ...ready, tagExists: true })).toEqual(['tag']);
    expect(ids({ ...ready, treeClean: false })).toEqual(['clean']);
    expect(ids({ ...ready, tests: undefined })).toEqual(['tests']);
    expect(ids({ ...ready, tests: { passed: 5, failed: 1 } })).toEqual(['tests']);
    expect(ids({ ...ready, tests: { passed: 0, failed: 0 } })).toEqual(['tests']);
    expect(ids({ ...ready, doneText: '## Open findings\n- Blocker: x breaks\n' })).toEqual(['findings']);
  });
  it('does not read "not a blocker" as a blocker', () => {
    const r = shipCheck({ ...ready, doneText: '## Open findings\n- Not a blocker: stale lock\n- No blockers found\n' });
    expect(r.items.find((i) => i.id === 'findings')?.ok).toBe(true);
  });
  it('lists non-blocking findings without failing', () => {
    const r = shipCheck({ ...ready, doneText: '## Minor findings left open\n- stale lock\n' });
    expect(r.ready).toBe(true);
    expect(r.openFindings).toEqual(['stale lock']);
    expect(r.items[1]?.detail).toMatch(/1 open finding listed/);
  });
  it('accepts [Unreleased] with content in place of a version section, and rejects an empty changelog', () => {
    const unreleased = '## [Unreleased]\n- New\n';
    expect(ids({ ...ready, version: '0.5.0', changelogText: unreleased })).toEqual([]);
    expect(ids({ ...ready, version: '0.5.0', changelogText: CHANGELOG })).toEqual(['changelog']);
    expect(ids({ ...ready, changelogText: undefined, version: '9.9.9' })).toEqual(['changelog']);
  });
});
