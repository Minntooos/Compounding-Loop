import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  countDoneRounds, parseLockTime, parseRunCounter, readLastCommitAt, readLoopFacts, readRunCounter,
} from '../../../src/core/repo.js';

describe('parseRunCounter', () => {
  it('reads N and the limit', () => {
    expect(parseRunCounter('# Task\n\nRun: 12 / 30\nStatus: x')).toEqual({ run: 12, limit: 30 });
  });
  it('tolerates trailing text', () => {
    expect(parseRunCounter('Run: 3 / 30 (budget)')).toEqual({ run: 3, limit: 30 });
  });
  it('returns undefined when missing', () => {
    expect(parseRunCounter('no counter here')).toBeUndefined();
  });
});

describe('parseLockTime', () => {
  it('reads an ISO timestamp', () => {
    expect(parseLockTime('2026-10-08T05:00:00Z\n')?.toISOString()).toBe('2026-10-08T05:00:00.000Z');
  });
  it('treats a zone-less timestamp as UTC', () => {
    expect(parseLockTime('2026-10-08 05:00')?.toISOString()).toBe('2026-10-08T05:00:00.000Z');
  });
  it('rejects garbage and empty text', () => {
    expect(parseLockTime('not a date')).toBeUndefined();
    expect(parseLockTime('  ')).toBeUndefined();
  });
});

describe('countDoneRounds', () => {
  it('counts only done-vN.md files', () => {
    expect(countDoneRounds(['done-v1.md', 'done-v2.md', 'done-v.md', 'task.md', 'done-v3.md.bak'])).toBe(2);
  });
});

describe('folder readers', () => {
  let dir: string;
  beforeEach(async () => { dir = await mkdtemp(path.join(tmpdir(), 'loop-repo-')); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true, maxRetries: 5 }); });

  it('reads facts from a folder with no .ai and no git', async () => {
    expect(await readLoopFacts(dir)).toEqual({ hasBlocked: false, hasDone: false, roundsDone: 0, healthFailures: [] });
  });

  it('reads stop files, rounds, lock and the last commit', async () => {
    await mkdir(path.join(dir, '.ai'));
    await writeFile(path.join(dir, 'DONE.md'), 'done');
    await writeFile(path.join(dir, '.ai', 'done-v1.md'), 'r1');
    await writeFile(path.join(dir, '.ai', 'session.lock'), '2026-10-08T05:00:00Z\n');
    await writeFile(path.join(dir, '.ai', 'task.md'), 'Run: 3 / 30\n');
    const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
    git('init', '-q');
    git('add', '-A');
    git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-qm', 'init');
    const facts = await readLoopFacts(dir);
    expect(facts).toMatchObject({ hasBlocked: false, hasDone: true, roundsDone: 1 });
    expect(facts.lockAt?.toISOString()).toBe('2026-10-08T05:00:00.000Z');
    expect(facts.lastCommitAt).toBeInstanceOf(Date);
    expect(await readLastCommitAt(dir)).toBeInstanceOf(Date);
    expect(await readRunCounter(dir)).toEqual({ run: 3, limit: 30 });
  });

  it('flags BLOCKED.md', async () => {
    await writeFile(path.join(dir, 'BLOCKED.md'), 'q');
    expect((await readLoopFacts(dir)).hasBlocked).toBe(true);
  });

  it('has no run counter without a task.md', async () => {
    expect(await readRunCounter(dir)).toBeUndefined();
  });
});
