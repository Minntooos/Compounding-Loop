import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadKit, runInit } from '../../../src/cli/init.js';

const tsx = path.resolve('node_modules/.bin/tsx');
const cli = path.resolve('src/cli/index.ts');

describe('loop init', () => {
  let dir: string;
  beforeEach(async () => { dir = await mkdtemp(path.join(tmpdir(), 'loop-init-')); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });
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
    const out = execFileSync(tsx, [cli, 'init', dir, '--force', '--dry-run'], { encoding: 'utf8' });
    expect(out).toContain('create    AGENTS.md');
  });
});
