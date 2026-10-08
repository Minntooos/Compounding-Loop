import { describe, expect, it } from 'vitest';
import { fillPlaceholders, hostLabel, isTextFile, templateTargetName, validateProjectName } from '../../../src/core/template.js';

describe('validateProjectName', () => {
  it('accepts simple names', () => {
    for (const ok of ['demo-x', 'a', 'my_site2']) expect(validateProjectName(ok)).toBeUndefined();
  });
  it('rejects paths, spaces, capitals and empties', () => {
    for (const bad of ['', '../x', 'a b', 'Demo', '-x', 'a/b', 'a'.repeat(101)]) expect(validateProjectName(bad)).toMatch(/not a valid name/);
  });
});

describe('fillPlaceholders', () => {
  it('fills known keys, with optional spaces, and keeps unknown ones', () => {
    expect(fillPlaceholders('{{name}} / {{ name }} / {{domain}}', { name: 'x' })).toBe('x / x / {{domain}}');
  });
});

describe('isTextFile', () => {
  it('fills text, copies binaries', () => {
    expect(isTextFile('index.html')).toBe(true);
    expect(isTextFile('.gitignore')).toBe(true);
    expect(isTextFile('logo.png')).toBe(false);
    expect(isTextFile('Makefile')).toBe(false);
  });
});

describe('templateTargetName', () => {
  it('turns the shipped `gitignore` into `.gitignore` and leaves other names alone', () => {
    expect(templateTargetName('gitignore')).toBe('.gitignore');
    expect(templateTargetName('package.json')).toBe('package.json');
  });
});

describe('hostLabel', () => {
  it('makes names hostname-safe', () => {
    expect(hostLabel('my_site')).toBe('my-site');
    expect(hostLabel('site-')).toBe('site');
    expect(hostLabel('a'.repeat(100))).toHaveLength(63);
    expect(hostLabel('a'.repeat(62) + '_b')).toBe('a'.repeat(62));
  });
});
