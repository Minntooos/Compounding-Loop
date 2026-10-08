import { execFile } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { LoopFacts } from './types.js';

const execFileAsync = promisify(execFile);

export interface RunCounter {
  run: number;
  limit: number;
}

/** Reads the `Run: N / LIMIT` line of a task.md; undefined when the line is missing or malformed. */
export function parseRunCounter(taskText: string): RunCounter | undefined {
  const match = /^Run:\s*(\d+)\s*\/\s*(\d+)\s*$/m.exec(taskText);
  if (!match) return undefined;
  return { run: Number(match[1]), limit: Number(match[2]) };
}

/** Parses the single UTC timestamp line of `.ai/session.lock`; undefined when it is not a valid date. */
export function parseLockTime(lockText: string): Date | undefined {
  const line = lockText.trim().split(/\r?\n/)[0]?.trim();
  if (!line) return undefined;
  const at = new Date(line);
  return Number.isNaN(at.getTime()) ? undefined : at;
}

/** Counts file names like `done-v1.md`, `done-v2.md`. */
export function countDoneRounds(fileNames: readonly string[]): number {
  return fileNames.filter((name) => /^done-v\d+\.md$/.test(name)).length;
}

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function readOptional(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, 'utf8');
  } catch {
    return undefined;
  }
}

/** Commit time of HEAD, or undefined when the folder is not a git repo or has no commits. */
export async function readLastCommitAt(dir: string): Promise<Date | undefined> {
  try {
    const { stdout } = await execFileAsync('git', ['log', '-1', '--format=%cI'], { cwd: dir });
    const at = new Date(stdout.trim());
    return Number.isNaN(at.getTime()) ? undefined : at;
  } catch {
    return undefined;
  }
}

/** Reads one loop's facts from its folder. Health failures are filled in by the health checks, not here. */
export async function readLoopFacts(dir: string): Promise<LoopFacts> {
  const aiDir = path.join(dir, '.ai');
  const aiFiles = await readdir(aiDir).catch(() => [] as string[]);
  const lockText = await readOptional(path.join(aiDir, 'session.lock'));
  const lockAt = lockText === undefined ? undefined : parseLockTime(lockText);
  const lastCommitAt = await readLastCommitAt(dir);
  return {
    // The stop files sit at the repo root, per CLAUDE.md "Unattended mode".
    hasBlocked: await exists(path.join(dir, 'BLOCKED.md')),
    hasDone: await exists(path.join(dir, 'DONE.md')),
    roundsDone: countDoneRounds(aiFiles),
    ...(lockAt && { lockAt }),
    ...(lastCommitAt && { lastCommitAt }),
    healthFailures: [],
  };
}

/** Reads `Run: N / LIMIT` from a loop's `.ai/task.md`. */
export async function readRunCounter(dir: string): Promise<RunCounter | undefined> {
  const text = await readOptional(path.join(dir, '.ai', 'task.md'));
  return text === undefined ? undefined : parseRunCounter(text);
}
