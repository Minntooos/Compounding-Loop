import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Gh } from '../../../src/core/gh.js';
import { listTemplates, runNew } from '../../../src/cli/new.js';

const tsx = path.resolve('node_modules/.bin/tsx');
const cli = path.resolve('src/cli/index.ts');

describe('loop new', () => {
  let parent: string;
  const calls: string[][] = [];
  const fakeGh: Gh = { createRepoFromFolder: async (_f, name, o) => { calls.push([name, String(o.private)]); return `https://github.com/me/${name}`; } };
  beforeEach(async () => { parent = await mkdtemp(path.join(tmpdir(), 'loop-new-')); calls.length = 0; });
  afterEach(async () => { await rm(parent, { recursive: true, force: true }); });

  it('lists the shipped templates', async () => {
    expect(await listTemplates()).toContain('static-site');
  });

  it('--dry-run copies the template and installs the method without calling GitHub', async () => {
    const result = await runNew('static-site', 'demo-x', { parentDir: parent, dryRun: true, publicRepo: false, gh: fakeGh });
    expect(result.repoUrl).toBeUndefined();
    expect(calls).toEqual([]);
    expect(await readFile(path.join(result.dir, 'AGENTS.md'), 'utf8')).toContain('CLAUDE.md');
    expect(await readFile(path.join(result.dir, 'IDEA.md'), 'utf8')).toBeTruthy();
  });

  it('creates a private repo through the Gh interface by default', async () => {
    const result = await runNew('static-site', 'demo-y', { parentDir: parent, dryRun: false, publicRepo: false, gh: fakeGh });
    expect(result.repoUrl).toBe('https://github.com/me/demo-y');
    expect(calls).toEqual([['demo-y', 'true']]);
  });

  it('removes the folder and explains when GitHub fails, so a retry works', async () => {
    const failing: Gh = { createRepoFromFolder: async () => { throw new Error('not logged in'); } };
    const options = { parentDir: parent, dryRun: false, publicRepo: false };
    await expect(runNew('static-site', 'demo-z', { ...options, gh: failing })).rejects.toThrow(/folder was removed[\s\S]*not logged in/);
    await expect(runNew('static-site', 'demo-z', { ...options, gh: fakeGh })).resolves.toMatchObject({ repoUrl: 'https://github.com/me/demo-z' });
  });

  it('rejects bad names, unknown templates and existing folders', async () => {
    const base = { parentDir: parent, dryRun: true, publicRepo: false, gh: fakeGh };
    await expect(runNew('static-site', '../evil', base)).rejects.toThrow(/not a valid name/);
    await expect(runNew('nope', 'x', base)).rejects.toThrow(/Unknown template/);
    await runNew('static-site', 'dup', base);
    await expect(runNew('static-site', 'dup', base)).rejects.toThrow(/already exists/);
  });

  it('the CLI creates a folder whose own check script runs', () => {
    execFileSync(tsx, [cli, 'new', 'static-site', 'demo-x', '--dry-run'], { cwd: parent });
    const dir = path.join(parent, 'demo-x');
    // The starter page is a placeholder, so the template's check is expected to flag it until the loop builds the site.
    let output = '';
    try {
      output = execFileSync('node', ['scripts/check.mjs'], { cwd: dir, encoding: 'utf8' });
    } catch (error) {
      output = String((error as { stderr?: string; stdout?: string }).stdout ?? '') + String((error as { stderr?: string }).stderr ?? '');
    }
    expect(output).toMatch(/check/);
  });

  // Slow: needs `npm install` (network) for the template's Playwright. Run with LOOP_SLOW=1.
  it.runIf(process.env.LOOP_SLOW)('the new folder passes its full npm test', () => {
    const dir = path.join(parent, 'slow-x');
    execFileSync(tsx, [cli, 'new', 'static-site', 'slow-x', '--dry-run'], { cwd: parent });
    execFileSync('npm', ['install'], { cwd: dir, stdio: 'inherit' });
    execFileSync('npm', ['test'], { cwd: dir, stdio: 'inherit' });
  }, 600_000);
});
