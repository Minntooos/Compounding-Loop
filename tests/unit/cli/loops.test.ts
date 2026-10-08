import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runAnswer, runNextRound, runStatus } from '../../../src/cli/loops.js';

const tsx = path.resolve('node_modules/.bin/tsx');
const cli = path.resolve('src/cli/index.ts');

describe('loop status / next-round / answer', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'loop-ops-'));
    await mkdir(path.join(dir, '.ai'));
    await writeFile(path.join(dir, '.ai', 'task.md'), '# T\n\nRun: 7 / 30\n\n## Decisions\n');
  });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  it('status shows a done loop with its run counter', async () => {
    await writeFile(path.join(dir, 'DONE.md'), 'x');
    expect(await runStatus([dir])).toMatch(/\+ done\s+round 1\s+run 7\/30/);
  });

  it('next-round archives DONE.md and writes the next task', async () => {
    await writeFile(path.join(dir, 'DONE.md'), '# DONE\n## Next 10 improvements\n1. One\n2. Two\n');
    await writeFile(path.join(dir, '.ai', 'session.lock'), '2026-10-08T05:00:00Z');
    expect(await runNextRound(dir, { dryRun: true })).toEqual({ archivedAs: 'done-v1.md', units: 2 });
    expect(await readFile(path.join(dir, 'DONE.md'), 'utf8')).toBeTruthy();
    await runNextRound(dir, { dryRun: false });
    await expect(readFile(path.join(dir, 'DONE.md'))).rejects.toThrow();
    expect(await readdir(path.join(dir, '.ai'))).toContain('done-v1.md');
    const task = await readFile(path.join(dir, '.ai', 'task.md'), 'utf8');
    expect(task).toContain('Run: 0 / 30');
    expect(task).toContain('# TASK: Round 2');
    expect(await readdir(path.join(dir, '.ai'))).not.toContain('session.lock');
  });

  it('next-round explains when there is nothing to do', async () => {
    await expect(runNextRound(dir, { dryRun: false })).rejects.toThrow(/No DONE.md/);
    await writeFile(path.join(dir, 'DONE.md'), '# DONE\nno list');
    await expect(runNextRound(dir, { dryRun: false })).rejects.toThrow(/no "next 10" list/);
  });

  it('answer --accept records the best guess, removes BLOCKED.md and commits', async () => {
    await writeFile(path.join(dir, 'BLOCKED.md'), '## Specific question\nWhich licence?\n\n## Best guess\nMIT\n');
    execFileSync('git', ['init', '-q'], { cwd: dir });
    const dry = await runAnswer(dir, 'accept', { dryRun: true });
    expect(dry).toMatchObject({ question: 'Which licence?', answer: 'MIT' });
    expect(await readFile(path.join(dir, 'BLOCKED.md'), 'utf8')).toBeTruthy();
    await runAnswer(dir, 'accept', { dryRun: false, now: new Date('2026-10-08T00:00:00Z') });
    await expect(readFile(path.join(dir, 'BLOCKED.md'))).rejects.toThrow();
    expect(await readFile(path.join(dir, '.ai', 'task.md'), 'utf8')).toContain('Answer: MIT');
    expect(execFileSync('git', ['log', '--format=%s'], { cwd: dir, encoding: 'utf8' })).toContain('Answer BLOCKED.md');
  });

  it('answering a run-budget block raises the limit and leaves unrelated staged files out', async () => {
    const g = (...a: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@e.x', ...a], { cwd: dir, encoding: 'utf8' });
    await writeFile(path.join(dir, '.ai', 'task.md'), '# T\n\nRun: 30 / 30\n\n## Decisions\n');
    await writeFile(path.join(dir, 'BLOCKED.md'), 'Run budget reached');
    g('init', '-q');
    g('add', '-A');
    g('commit', '-qm', 'base');
    await writeFile(path.join(dir, 'other.txt'), 'wip');
    g('add', 'other.txt');
    await runAnswer(dir, 'accept', { dryRun: false });
    expect(await readFile(path.join(dir, '.ai', 'task.md'), 'utf8')).toContain('Run: 30 / 60');
    expect(g('show', '--name-only', '--format=', 'HEAD')).not.toContain('other.txt');
    expect(g('status', '--short')).toContain('A  other.txt');
  });

  it('answer refuses outside a git repo before changing anything', async () => {
    await writeFile(path.join(dir, 'BLOCKED.md'), '## Best guess\nMIT');
    await expect(runAnswer(dir, 'accept', { dryRun: false })).rejects.toThrow(/not a git repository/);
    expect(await readFile(path.join(dir, 'BLOCKED.md'), 'utf8')).toBeTruthy();
  });

  it('answer fails clearly without BLOCKED.md or a guess to accept', async () => {
    await expect(runAnswer(dir, 'x', { dryRun: false })).rejects.toThrow(/No BLOCKED.md/);
    await writeFile(path.join(dir, 'BLOCKED.md'), 'stuck');
    await expect(runAnswer(dir, 'accept', { dryRun: false })).rejects.toThrow(/no best guess/);
  });

  it('runs through the CLI', () => {
    const out = execFileSync(tsx, [cli, 'status', dir], { encoding: 'utf8' });
    expect(out).toContain('Nothing needs you.');
    expect(() => execFileSync(tsx, [cli, 'answer', 'x', '--dir', dir], { stdio: 'pipe' })).toThrow(/No BLOCKED.md/);
  });
});
