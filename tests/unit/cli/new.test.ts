import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Gh } from '../../../src/core/gh.js';
import { listTemplates, runNew } from '../../../src/cli/new.js';

// Run tsx's CLI through node: node_modules/.bin/tsx is a .cmd shim on Windows, which execFile cannot start.
const tsx = path.resolve('node_modules/tsx/dist/cli.mjs');
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

  it('writes a shipped `gitignore` as .gitignore and fills {{host}}', async () => {
    const root = path.join(parent, 'pkg');
    await mkdir(path.join(root, 'templates', 't'), { recursive: true });
    await writeFile(path.join(root, 'templates', 't', 'gitignore'), 'node_modules\n');
    await writeFile(path.join(root, 'templates', 't', 'netlify.toml'), 'site = "{{host}}.netlify.app"\n');
    const result = await runNew('t', 'my_site', { parentDir: parent, dryRun: true, publicRepo: false, gh: fakeGh, root });
    expect(await readFile(path.join(result.dir, '.gitignore'), 'utf8')).toBe('node_modules\n');
    expect(await readFile(path.join(result.dir, 'netlify.toml'), 'utf8')).toBe('site = "my-site.netlify.app"\n');
  });

  it('creates a private repo through the Gh interface by default', async () => {
    const result = await runNew('static-site', 'demo-y', { parentDir: parent, dryRun: false, publicRepo: false, gh: fakeGh });
    expect(result.repoUrl).toBe('https://github.com/me/demo-y');
    expect(calls).toEqual([['demo-y', 'true']]);
  });

  it('keeps the folder and prints how to finish when GitHub fails', async () => {
    const failing: Gh = { createRepoFromFolder: async () => { throw new Error('not logged in'); } };
    const options = { parentDir: parent, dryRun: false, publicRepo: false };
    await expect(runNew('static-site', 'demo-z', { ...options, gh: failing })).rejects.toThrow(/folder was kept[\s\S]*gh repo create demo-z[\s\S]*not logged in/);
    expect((await stat(path.join(parent, 'demo-z', '.ai'))).isDirectory()).toBe(true);
  });

  it('rejects bad names, unknown templates and existing folders', async () => {
    const base = { parentDir: parent, dryRun: true, publicRepo: false, gh: fakeGh };
    await expect(runNew('static-site', '../evil', base)).rejects.toThrow(/not a valid name/);
    await expect(runNew('nope', 'x', base)).rejects.toThrow(/Unknown template/);
    await runNew('static-site', 'dup', base);
    await expect(runNew('static-site', 'dup', base)).rejects.toThrow(/already exists/);
  });

  it('the CLI creates a folder whose own check script runs', () => {
    execFileSync(process.execPath, [tsx, cli, 'new', 'static-site', 'demo-x', '--dry-run'], { cwd: parent });
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
    execFileSync(process.execPath, [tsx, cli, 'new', 'static-site', 'slow-x', '--dry-run'], { cwd: parent });
    execFileSync('npm', ['install'], { cwd: dir, stdio: 'inherit' });
    execFileSync('npm', ['test'], { cwd: dir, stdio: 'inherit' });
  }, 600_000);
});
