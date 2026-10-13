import { describe, expect, it } from 'vitest';
import { npmPackageUrl } from '../../../src/server/controls.js';
import { annotateReleases, isShipped, npmStateOf, parseNpmPackage } from '../../../src/server/shipped.js';
import { packageName } from '../../../src/server/roundState.js';

const doc = { 'dist-tags': { latest: '1.2.0' }, versions: { '1.1.0': {}, '1.2.0': {} } };

describe('parseNpmPackage', () => {
  it('reads latest and the published versions', () => {
    expect(parseNpmPackage(doc)).toEqual({ latest: '1.2.0', versions: ['1.1.0', '1.2.0'] });
  });
  it('treats anything else as unreadable', () => {
    for (const bad of [undefined, null, 'x', [], { error: 'Not found' }, { versions: 3 }]) expect(parseNpmPackage(bad)).toBeUndefined();
  });
  it('a package without dist-tags has versions but no latest', () => {
    expect(parseNpmPackage({ versions: { '1.0.0': {} } })).toEqual({ versions: ['1.0.0'] });
  });
});

describe('npmStateOf', () => {
  const npm = parseNpmPackage(doc);
  it('names each state', () => {
    expect([npmStateOf('1.2.0', npm), npmStateOf('1.1.0', npm), npmStateOf('2.0.0', npm), npmStateOf('1.2.0', undefined)]).toEqual(['latest', 'published', 'not-published', 'unknown']);
  });
});

describe('isShipped', () => {
  const npm = parseNpmPackage(doc);
  it('needs the tag', () => {
    expect(isShipped({ version: '1.2.0', tagExists: false, npm })).toBe(false);
  });
  it('needs npm latest to match when npm was read', () => {
    expect(isShipped({ version: '1.2.0', tagExists: true, npm })).toBe(true);
    expect(isShipped({ version: '1.1.0', tagExists: true, npm })).toBe(false);
  });
  it('falls back to the tag when npm was not read or has no latest', () => {
    expect(isShipped({ version: '1.2.0', tagExists: true })).toBe(true);
    expect(isShipped({ version: '1.2.0', tagExists: true, npm: { versions: [] } })).toBe(true);
  });
});

describe('annotateReleases', () => {
  it('adds tag and npm state, leaving Unreleased alone', () => {
    const releases = [{ version: 'Unreleased', sections: [], items: [] }, { version: '1.2.0', sections: [], items: [] }, { version: '1.0.0', sections: [], items: [] }];
    expect(annotateReleases(releases, ['v1.2.0'], parseNpmPackage(doc)).map((r) => [r.version, r.tag, r.npm])).toEqual([['Unreleased', undefined, undefined], ['1.2.0', true, 'latest'], ['1.0.0', false, 'not-published']]);
  });
});

describe('npmPackageUrl and packageName', () => {
  it('builds registry URLs and rejects odd names', () => {
    expect(npmPackageUrl('compounding-loop')).toBe('https://registry.npmjs.org/compounding-loop');
    expect(npmPackageUrl('@o/p')).toBe('https://registry.npmjs.org/@o%2fp');
    for (const bad of ['', '../x', 'a b', 'a/b', 'UPPER']) expect(() => npmPackageUrl(bad)).toThrow();
  });
  it('reads the name from package.json text', () => {
    expect(packageName('{"name":"x"}')).toBe('x');
    expect([packageName(undefined), packageName('nope'), packageName('{"name":3}')]).toEqual([undefined, undefined, undefined]);
  });
});
