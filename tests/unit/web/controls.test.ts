import { describe, expect, it } from 'vitest';
import { githubUrl, releaseBlocker, slugOf } from '../../../web/src/lib/controls.js';

const NOW = new Date('2026-10-11T14:05:00Z');
describe('dashboard controls', () => {
  it('reads the repo slug from a GitHub URL only', () => {
    expect(slugOf('https://github.com/Minntooos/Compounding-Loop')).toBe('Minntooos/Compounding-Loop');
    expect(slugOf('https://github.com/a/b.git')).toBe('a/b');
    expect(slugOf('https://minntooos.github.io/Compounding-Loop/')).toBeUndefined();
    expect(slugOf(undefined)).toBeUndefined();
  });
  it('builds the exact prefilled GitHub pages', () => {
    expect(githubUrl('resume', 'a/b')).toBe('https://github.com/a/b/delete/main/.ai/PAUSED');
    expect(githubUrl('release', 'a/b')).toBe('https://github.com/a/b/actions/workflows/release.yml');
    const pause = githubUrl('pause', 'a/b', { now: NOW, reason: 'budget' }) ?? '';
    expect(pause.startsWith('https://github.com/a/b/new/main?filename=.ai%2FPAUSED&value=')).toBe(true);
    expect(decodeURIComponent(pause)).toContain('budget');
    expect(githubUrl('next-round', 'a/b', { brief: '# Brief\nx' })).toBe('https://github.com/a/b/new/main?filename=.ai%2Fnext-round.md&value=%23%20Brief%0Ax%0A');
    expect(githubUrl('next-round', 'a/b', { brief: 'x'.repeat(9000) })).toBeUndefined();
    expect(githubUrl('next-round', 'a/b')).toBeUndefined();
  });
  it('names the first failing ship-check item as the release blocker', () => {
    expect(releaseBlocker({})).toContain('DONE.md');
    expect(releaseBlocker({ ship: { ready: true, items: [], openFindings: [] } })).toBeUndefined();
    expect(releaseBlocker({ ship: { ready: false, openFindings: [], items: [{ id: 'a', label: 'Tests pass', ok: true, detail: 'ok' }, { id: 'b', label: 'Tag is free', ok: false, detail: 'v1 exists.' }] } })).toBe('Release is off · Tag is free · v1 exists');
  });

  it('adds no colon of its own (round 5 A8: "Release is off: Tests pass: no result")', () => {
    expect(releaseBlocker({ ship: { ready: false, openFindings: [], items: [{ id: 't', label: 'Tests pass', ok: false, detail: 'no result' }] } })).not.toContain(':');
  });
});
