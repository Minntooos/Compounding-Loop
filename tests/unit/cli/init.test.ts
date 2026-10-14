import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadKit, runInit } from '../../../src/cli/init.js';

// Run tsx's CLI through node: node_modules/.bin/tsx is a .cmd shim on Windows, which execFile cannot start.
const tsx = path.resolve('node_modules/tsx/dist/cli.mjs');
const cli = path.resolve('src/cli/index.ts');

describe('loop init', () => {
  let dir: string;
  beforeEach(async () => { dir = await mkdtemp(path.join(tmpdir(), 'loop-init-')); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true, maxRetries: 5 }); });
  const kit = { files: [{ dest: '.ai/log.md', content: 'LOG' }], card: 'CARD', missing: [] };

  it('refuses without a good brief', async () => {
    const result = await runInit(dir, { force: false, dryRun: false }, kit);
    expect(result.refused).toMatch(/IDEA.md is missing/);
    await expect(readFile(path.join(dir, 'CLAUDE.md'))).rejects.toThrow();
  });

  it('with --force writes the kit, and is idempotent', async () => {
    await runInit(dir, { force: true, dryRun: false }, kit);
    expect(await readFile(path.join(dir, 'CLAUDE.md'), 'utf8')).toContain('CARD');
    expect(await readFile(path.join(dir, '.ai', 'log.md'), 'utf8')).toBe('LOG');
    const second = await runInit(dir, { force: true, dryRun: false }, kit);
    expect(second.actions.every((a) => a.kind === 'skip')).toBe(true);
  });

  it('keeps user log and refuses broken markers', async () => {
    await mkdir(path.join(dir, '.ai'));
    await writeFile(path.join(dir, '.ai', 'log.md'), 'MINE');
    const real = await loadKit();
    await runInit(dir, { force: true, dryRun: false }, { ...real, files: real.files.filter((f) => f.dest === '.ai/log.md').map((f) => ({ ...f, keep: true })) });
    expect(await readFile(path.join(dir, '.ai', 'log.md'), 'utf8')).toBe('MINE');
    await writeFile(path.join(dir, 'CLAUDE.md'), '<!-- compounding-loop:start -->\n');
    expect((await runInit(dir, { force: true, dryRun: false }, kit)).refused).toMatch(/broken/);
  });

  it('dry-run writes nothing', async () => {
    await runInit(dir, { force: true, dryRun: true }, kit);
    await expect(readFile(path.join(dir, 'AGENTS.md'))).rejects.toThrow();
  });

  it('keeps an existing CLAUDE.md and appends the card', async () => {
    await writeFile(path.join(dir, 'CLAUDE.md'), '# Mine\n');
    await runInit(dir, { force: true, dryRun: false }, kit);
    const text = await readFile(path.join(dir, 'CLAUDE.md'), 'utf8');
    expect(text.startsWith('# Mine')).toBe(true);
    expect(text).toContain('CARD');
  });

  it('loads the real kit with fallbacks for files kit has not shipped', async () => {
    const real = await loadKit();
    expect(real.files.map((f) => f.dest)).toContain('.ai/task.md');
  });

  it('runs end to end through the CLI', async () => {
    const out = execFileSync(process.execPath, [tsx, cli, 'init', dir, '--force', '--dry-run'], { encoding: 'utf8' });
    expect(out).toContain('create    AGENTS.md');
  });

  it('--hooks writes .ai/triggers.yaml and .claude/settings.json in an empty repo, and re-running changes nothing', async () => {
    const real = await loadKit();
    const first = await runInit(dir, { force: true, dryRun: false, hooks: true }, real);
    expect(first.hooksAdded).toHaveLength(5);
    expect(await readFile(path.join(dir, '.ai', 'triggers.yaml'), 'utf8')).toContain('Triggers:');
    const settings = JSON.parse(await readFile(path.join(dir, '.claude', 'settings.json'), 'utf8')) as { hooks: Record<string, unknown> };
    expect(Object.keys(settings.hooks)).toEqual(['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure']);
    const second = await runInit(dir, { force: true, dryRun: false, hooks: true }, real);
    expect(second.hooksAdded).toEqual([]);
    expect(second.actions.find((a) => a.dest === '.claude/settings.json')?.kind).toBe('skip');
  });

  it('without --hooks no settings file is written; a broken settings file refuses with --hooks', async () => {
    await runInit(dir, { force: true, dryRun: false }, await loadKit());
    await expect(readFile(path.join(dir, '.claude', 'settings.json'))).rejects.toThrow();
    await mkdir(path.join(dir, '.claude'));
    await writeFile(path.join(dir, '.claude', 'settings.json'), '{nope');
    expect((await runInit(dir, { force: true, dryRun: false, hooks: true }, await loadKit())).refused).toMatch(/not valid JSON/);
    expect(await readFile(path.join(dir, '.claude', 'settings.json'), 'utf8')).toBe('{nope');
  });

  it('--dry-run with --hooks writes nothing', async () => {
    await runInit(dir, { force: true, dryRun: true, hooks: true }, await loadKit());
    await expect(readFile(path.join(dir, '.claude', 'settings.json'))).rejects.toThrow();
  });

  it('offers the seed recipes that match the repo, and --recipes installs them', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'loop-seeds-'));
    try {
      await mkdir(path.join(root, 'templates', 'recipes'), { recursive: true });
      const seed = (id: string, stack: string) => `---\nid: ${id}\ntitle: ${id}\nkind: project\nstack: [${stack}]\ntags: []\nstatus: CONFIRMED\nsource: o/r@abc1234\nuses: 0\npasses: 0\nupdated: 2026-10-14\n---\n# ${id}\n`;
      await writeFile(path.join(root, 'templates', 'recipes', 'a.md'), seed('R-fits', 'node@20'));
      await writeFile(path.join(root, 'templates', 'recipes', 'b.md'), seed('R-other', 'ruby@3'));
      await writeFile(path.join(dir, 'package.json'), '{"engines":{"node":">=20"}}');
      const offered = await runInit(dir, { force: true, dryRun: false }, kit, root);
      expect(offered.recipeOffers.map((o) => o.id)).toEqual(['R-fits']);
      await expect(readFile(path.join(dir, '.ai', 'recipes', 'R-fits.md'))).rejects.toThrow();
      const installed = await runInit(dir, { force: true, dryRun: false, recipes: true }, kit, root);
      expect(installed.recipeOffers).toEqual([]);
      expect(await readFile(path.join(dir, '.ai', 'recipes', 'R-fits.md'), 'utf8')).toContain('R-fits');
      expect((await runInit(dir, { force: true, dryRun: false }, kit, root)).recipeOffers).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 5 });
    }
  });
});
