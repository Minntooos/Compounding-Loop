import { describe, expect, it } from 'vitest';
import { buildLiveLoop, deleteFileUrl, editFileUrl, latestReleaseRunApiUrl, newFileUrl, nextRoundUrl, pauseUrl, releaseWorkflowUrl, resumeUrl, tagsApiUrl } from '../../../src/server/live/index.js';

const SLUG = 'Minntooos/Compounding-Loop';
const NOW = new Date('2026-10-11T12:00:00Z');

describe('GitHub URL builders', () => {
  it('Pause opens the new-file page for .ai/PAUSED with the one-line content core writes', () => {
    const url = new URL(pauseUrl(SLUG, 'Ada', NOW, 'usage limit'));
    expect(url.origin + url.pathname).toBe(`https://github.com/${SLUG}/new/main`);
    expect(url.searchParams.get('filename')).toBe('.ai/PAUSED');
    expect(url.searchParams.get('value')).toBe('Ada · paused 2026-10-11T12:00:00.000Z · usage limit\n');
    expect(new URL(pauseUrl(SLUG, ' ', NOW)).searchParams.get('value')).toBe('dashboard · paused 2026-10-11T12:00:00.000Z\n');
  });

  it('Resume opens the delete page, Start next round the new-file page for .ai/next-round.md, Release the workflow page', () => {
    expect(resumeUrl(SLUG)).toBe(`https://github.com/${SLUG}/delete/main/.ai/PAUSED`);
    const round = new URL(nextRoundUrl(SLUG, 'Goal: ship & test #1'));
    expect(round.searchParams.get('filename')).toBe('.ai/next-round.md');
    expect(round.searchParams.get('value')).toBe('Goal: ship & test #1\n');
    expect(releaseWorkflowUrl(SLUG)).toBe(`https://github.com/${SLUG}/actions/workflows/release.yml`);
    expect(latestReleaseRunApiUrl(SLUG)).toBe(`https://api.github.com/repos/${SLUG}/actions/workflows/release.yml/runs?per_page=1`);
    expect(tagsApiUrl(SLUG)).toBe(`https://api.github.com/repos/${SLUG}/tags?per_page=100`);
  });

  it('the Inbox links to the web editor for BLOCKED.md and a lane file', () => {
    expect(editFileUrl(SLUG, 'BLOCKED.md')).toBe(`https://github.com/${SLUG}/edit/main/BLOCKED.md`);
    expect(editFileUrl(SLUG, '.ai/lanes/web/BLOCKED.md', 'dev')).toBe(`https://github.com/${SLUG}/edit/dev/.ai/lanes/web/BLOCKED.md`);
  });

  it('refuses a slug or path that could point elsewhere', () => {
    expect(() => pauseUrl('../x', 'a', NOW)).toThrow(/slug/);
    expect(() => releaseWorkflowUrl('a/b/c')).toThrow(/slug/);
    for (const bad of ['', '/etc/passwd', '../x', 'a/../b', 'a\\b', 'a//b']) expect(() => deleteFileUrl(SLUG, bad)).toThrow(/path/);
    expect(() => newFileUrl(SLUG, '../x', 'y')).toThrow(/path/);
  });
});

describe('control data in the live loop', () => {
  const lanes = JSON.stringify({ lanes: [{ name: 'core', owns: ['src/**'], cron: '0 * * * *' }], shared: [] });
  const base = { slug: SLUG, commits: [], runs: {}, now: NOW, tags: [{ name: 'v0.3.0' }] };
  const changelog = '# Changelog\n\n## [Unreleased]\n\n## [0.4.0] - 2026-10-12\n\n### Added\n- the dashboard runs the loop\n';

  it('reads PAUSED, the newest control-room note per lane and the CHANGELOG releases', () => {
    const { detail } = buildLiveLoop({ ...base, files: {
      '.ai/lanes.json': lanes,
      '.ai/PAUSED': 'Ada · paused 2026-10-11T09:00:00.000Z · limit\n',
      '.ai/control-room.md': '2026-10-11 08:00 UTC · to core · old\n2026-10-11 10:00 UTC · to all · new note\n',
      'CHANGELOG.md': changelog,
    } });
    expect(detail.paused).toEqual({ by: 'Ada', at: '2026-10-11T09:00:00.000Z', reason: 'limit' });
    expect(detail.controlNotes).toEqual([{ lane: 'core', at: '2026-10-11T10:00:00.000Z', text: 'new note' }]);
    expect(detail.releases?.map((r) => r.version)).toEqual(['Unreleased', '0.4.0']);
  });

  it('builds the ship-check from DONE.md, the CHANGELOG, the tags and the version', () => {
    const files = { '.ai/lanes.json': lanes, 'DONE.md': '# Done\n', 'package.json': '{"version":"0.4.0"}', 'CHANGELOG.md': changelog };
    const ready = buildLiveLoop({ ...base, files }).detail.ship;
    expect(ready?.items.map((i) => [i.id, i.ok]).filter(([id]) => id !== 'tests')).toEqual([['done', true], ['findings', true], ['changelog', true], ['tag', true], ['clean', true]]);
    const tagged = buildLiveLoop({ ...base, tags: [{ name: 'v0.4.0' }], files }).detail.ship;
    expect(tagged?.ready).toBe(false);
    expect(tagged?.items.find((i) => i.id === 'tag')?.ok).toBe(false);
    expect(buildLiveLoop({ ...base, files: { ...files, 'DONE.md': undefined } }).detail.ship).toBeUndefined();
  });

  it('has none of it for an ordinary loop', () => {
    const { detail } = buildLiveLoop({ ...base, files: {} });
    expect([detail.paused, detail.controlNotes, detail.releases, detail.ship]).toEqual([undefined, undefined, undefined, undefined]);
  });
});
