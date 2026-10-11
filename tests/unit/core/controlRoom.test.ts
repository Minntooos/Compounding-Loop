import { describe, expect, it } from 'vitest';
import { commitLane, latestControlNotes } from '../../../src/core/parse/controlRoom.js';

const MD = `# Control room notes

Header paragraph.

2026-10-11 20:30 UTC · to all · Round 4 started
2026-10-11 07:55 UTC · to web · fix the self card
2026-10-11 06:45 UTC · to server, kit · wake up
2026-10-10 22:20 UTC · to core · windows cmd shims
`;

describe('latestControlNotes', () => {
  it('picks the newest note addressed to the lane by name or to all', () => {
    const notes = latestControlNotes(MD, ['core', 'kit', 'web', 'docs']);
    expect(notes.web?.text).toBe('Round 4 started');
    expect(notes.docs?.text).toBe('Round 4 started');
    expect(Object.keys(notes)).toEqual(['core', 'kit', 'web', 'docs']);
  });
  it('prefers a newer named note over an older all note', () => {
    const notes = latestControlNotes('2026-10-12 08:00 UTC · to web · later\n2026-10-11 20:30 UTC · to all · earlier\n', ['web', 'kit']);
    expect(notes.web?.text).toBe('later');
    expect(notes.kit?.text).toBe('earlier');
  });
  it('omits lanes without notes and tolerates empty input', () => {
    expect(latestControlNotes('2026-10-10 22:20 UTC · to core · x\n', ['web'])).toEqual({});
    expect(latestControlNotes('', ['web'])).toEqual({});
  });
});

describe('commitLane', () => {
  const lanes = ['core', 'web'];
  it('reads the trailer first, even over a different prefix', () => {
    expect(commitLane('web: fix\n\nLane: core', lanes)).toBe('core');
    expect(commitLane('Release 0.3.0\n\nLane: release', lanes)).toBe('release');
  });
  it('falls back to a lane prefix, control room, and Release subjects', () => {
    expect(commitLane('web: loop header', lanes)).toBe('web');
    expect(commitLane('control room: product DONE', lanes)).toBe('control');
    expect(commitLane('Release 0.3.0', lanes)).toBe('release');
    expect(commitLane('Release v1.0.0\n\nbody', lanes)).toBe('release');
  });
  it('is other when nothing matches', () => {
    expect(commitLane('Fix tests on Windows: run tsx', lanes)).toBe('other');
    expect(commitLane('kit: not a known lane here', lanes)).toBe('other');
    expect(commitLane('', lanes)).toBe('other');
  });
});
