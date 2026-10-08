import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CONTROL_LANE, checkCommitFiles, isValidLaneName, laneForPath, matchGlob, normalizePath, parseLaneTrailer, parseLanesConfig, validateLanesConfig } from '../../../src/core/lanes.js';

const good = {
  lanes: [
    { name: 'core', owns: ['src/core/**', 'bin/**'], cron: '7 * * * *' },
    { name: 'web', owns: ['web/**', 'tests/e2e/**'] },
    { name: 'docs', owns: ['README.md', 'docs/**'] },
  ],
  shared: ['package.json', 'tsconfig*.json', '.ai/audit/**'],
};
const config = validateLanesConfig(good).config!;

describe('matchGlob', () => {
  it('handles **, *, ? and literals', () => {
    expect(matchGlob('src/core/**', 'src/core/a/b.ts')).toBe(true);
    expect(matchGlob('src/core/**', 'src/cli/a.ts')).toBe(false);
    expect(matchGlob('**/*.md', 'README.md')).toBe(true);
    expect(matchGlob('**/*.md', 'a/b/c.md')).toBe(true);
    expect(matchGlob('tsconfig*.json', 'tsconfig.build.json')).toBe(true);
    expect(matchGlob('tsconfig*.json', 'sub/tsconfig.json')).toBe(false);
    expect(matchGlob('a?.ts', 'ab.ts')).toBe(true);
    expect(matchGlob('README.md', 'READMExmd')).toBe(false);
  });
  it('accepts Windows-style paths', () => {
    expect(matchGlob('src/core/**', 'src\\core\\lanes.ts')).toBe(true);
    expect(normalizePath('.\\web\\a.ts')).toBe('web/a.ts');
  });
});

describe('validateLanesConfig', () => {
  it('accepts a good config and this repo\'s own', () => {
    expect(validateLanesConfig(good).errors).toEqual([]);
    const own = parseLanesConfig(readFileSync('.ai/lanes.json', 'utf8'));
    expect(own.errors).toEqual([]);
    expect(own.config?.lanes).toHaveLength(5);
  });
  it('rejects overlapping ownership', () => {
    const r = validateLanesConfig({ lanes: [{ name: 'a', owns: ['src/**'] }, { name: 'b', owns: ['src/core/**'] }], shared: [] });
    expect(r.config).toBeUndefined();
    expect(r.errors[0]).toMatch(/both own/);
  });
  it('allows disjoint siblings', () => {
    expect(validateLanesConfig({ lanes: [{ name: 'a', owns: ['src/a/**'] }, { name: 'b', owns: ['src/b/**'] }] }).errors).toEqual([]);
  });
  it('rejects bad names, duplicates, empty input and bad JSON', () => {
    expect(validateLanesConfig({ lanes: [{ name: 'Bad Name', owns: ['x/**'] }] }).errors[0]).toMatch(/invalid/);
    expect(validateLanesConfig({ lanes: [{ name: CONTROL_LANE, owns: ['x/**'] }] }).errors[0]).toMatch(/reserved/);
    expect(validateLanesConfig({ lanes: [{ name: 'a', owns: ['x/**'] }, { name: 'a', owns: ['y/**'] }] }).errors.join()).toMatch(/twice/);
    expect(validateLanesConfig({ lanes: [] }).errors[0]).toMatch(/at least one lane/);
    expect(validateLanesConfig({ lanes: [{ name: 'a', owns: [] }] }).errors[0]).toMatch(/owns/);
    expect(validateLanesConfig(null).errors).toHaveLength(1);
    expect(parseLanesConfig('{nope').errors[0]).toMatch(/not valid JSON/);
  });
  it('isValidLaneName', () => {
    expect(isValidLaneName('core')).toBe(true);
    expect(isValidLaneName('1x')).toBe(false);
    expect(isValidLaneName('control')).toBe(false);
  });
});

describe('laneForPath', () => {
  it('finds owners, shared paths, the lane\'s own folder, and orphans', () => {
    expect(laneForPath(config, 'src/core/lanes.ts')).toBe('core');
    expect(laneForPath(config, 'package.json')).toBe('shared');
    expect(laneForPath(config, '.ai/lanes/web/task.md')).toBe('web');
    expect(laneForPath(config, 'src\\core\\x.ts')).toBe('core');
    expect(laneForPath(config, 'random.txt')).toBeUndefined();
  });
});

describe('parseLaneTrailer', () => {
  it('finds the last Lane: line', () => {
    expect(parseLaneTrailer('fix\n\nbody\n\nLane: core\n')).toBe('core');
    expect(parseLaneTrailer('fix\n\nLane: Core\r\nCo-Authored-By: x')).toBe('core');
    expect(parseLaneTrailer('fix\n\nLane: core\n\nCo-Authored-By: x')).toBe('core');
    expect(parseLaneTrailer('no trailer')).toBeUndefined();
  });
});

describe('checkCommitFiles', () => {
  it('passes owned, shared and own-folder files', () => {
    expect(checkCommitFiles(config, 'core', ['src/core/a.ts', 'package.json', '.ai/lanes/core/task.md'])).toEqual([]);
  });
  it('names the file, the lane and the fix when a lane crosses over', () => {
    const [v] = checkCommitFiles(config, 'core', ['web\\App.tsx']);
    expect(v?.file).toBe('web/App.tsx');
    expect(v?.message).toMatch(/lane "core" touched web\/App.tsx/);
    expect(v?.message).toMatch(/belongs to lane "web"/);
    expect(v?.message).toMatch(/outbox/);
  });
  it('flags unowned files and another lane\'s folder', () => {
    expect(checkCommitFiles(config, 'core', ['random.txt'])[0]?.message).toMatch(/no lane owns it/);
    expect(checkCommitFiles(config, 'core', ['.ai/lanes/web/outbox.md'])[0]?.message).toMatch(/lane "web"/);
  });
  it('lets control touch anything and rejects unknown lanes', () => {
    expect(checkCommitFiles(config, CONTROL_LANE, ['web/a.ts'])).toEqual([]);
    expect(checkCommitFiles(config, 'ghost', ['a'])[0]?.message).toMatch(/unknown lane "ghost"/);
  });
});
