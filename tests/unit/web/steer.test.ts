import { describe, expect, it } from 'vitest';
import { parseSteer } from '../../../src/core/parse/steer.js';
import { shellWord, steerCommand, steerDraft, steerEditUrl, steerNewFileUrl, steerText } from '../../../web/src/lib/steer.js';

const at = new Date('2026-10-13T14:05:31Z');

describe('steerText', () => {
  it('leads with the unit when one is given', () => {
    expect(steerText('4', ' Ship the legend first. ')).toBe('Unit 4: Ship the legend first.');
    expect(steerText('Unit 4', 'x')).toBe('Unit 4: x');
  });
  it('is the plain text without a unit, and empty stays empty', () => {
    expect(steerText(undefined, 'Do it')).toBe('Do it');
    expect(steerText('  ', 'Do it')).toBe('Do it');
    expect(steerText('4', '  ')).toBe('');
  });
});

describe('steerDraft', () => {
  it('is the exact entry core writes, at the lane steer.md', () => {
    const d = steerDraft({ lane: 'web', unit: '4', scope: 'next-run', text: 'Ship the legend first.', author: 'sam', at });
    expect(d.path).toBe('.ai/lanes/web/steer.md');
    expect(d.entry).toBe('## 2026-10-13 14:05 UTC · sam · next-run\nUnit 4: Ship the legend first.\n');
  });
  it('round-trips through core’s parser', () => {
    const d = steerDraft({ lane: 'core', scope: 'standing', text: 'Keep tests fast.\n## not a heading', author: 'a · b', at });
    expect(parseSteer(d.entry)).toEqual([{ at: '2026-10-13T14:05:00.000Z', author: 'a b', scope: 'standing', text: 'Keep tests fast.\n### not a heading' }]);
  });
});

describe('steerCommand', () => {
  it('builds a one-line loop steer command', () => {
    expect(steerCommand({ lane: 'web', scope: 'next-run', text: 'Fix\nthe strip' })).toBe("npx compounding-loop steer -- web 'Fix\nthe strip'");
    expect(steerCommand({ lane: 'web', unit: '5', scope: 'standing', text: 'go', author: 'Sam Lee' })).toBe("npx compounding-loop steer --standing --author 'Sam Lee' -- web 'Unit 5: go'");
  });
  it('escapes what a shell would expand', () => {
    expect(shellWord('plain-word')).toBe('plain-word');
    expect(shellWord('-x')).toBe("'-x'");
    expect(shellWord("don't! $HOME `x`")).toBe("'don'\\''t! $HOME `x`'");
  });
});

describe('steerEditUrl', () => {
  it('opens GitHub’s editor on the lane steer.md', () => {
    expect(steerEditUrl('Minntooos/Compounding-Loop', 'web')).toBe('https://github.com/Minntooos/Compounding-Loop/edit/main/.ai/lanes/web/steer.md');
  });
  it('refuses a lane name that is not a safe path', () => {
    expect(() => steerEditUrl('a/b', '../x')).toThrow();
  });
});

describe('steerNewFileUrl', () => {
  it('prefills a new steer.md with the entry, and gives up when the URL would be too long', () => {
    expect(steerNewFileUrl('o/r', 'web', '## x\n')).toBe('https://github.com/o/r/new/main?filename=.ai%2Flanes%2Fweb%2Fsteer.md&value=%23%23%20x%0A');
    expect(steerNewFileUrl('o/r', 'web', 'x'.repeat(8000))).toBeUndefined();
  });
});
