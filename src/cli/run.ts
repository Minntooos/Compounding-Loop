import { spawn } from 'node:child_process';
import { appendFile, mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseLockTime } from '../core/repo.js';
import { LOCK_MINUTES } from '../core/status.js';
import { buildClaudeArgs, buildRunPrompt, DEFAULT_PROMPT } from '../core/runPrompt.js';
import { packageRoot } from './init.js';

const exists = (file: string) => stat(file).then(() => true, () => false);

/** First readable prompt: the repo's own, then the routine prompt in the repo, then the package's, then the built-in. */
export async function loadPromptText(dir: string, root: string = packageRoot): Promise<{ text: string; source: string }> {
  const candidates = [
    path.join(dir, '.ai', 'loop-prompt.md'),
    path.join(dir, 'runners', 'routine', 'prompt.md'),
    path.join(root, 'runners', 'routine', 'prompt.md'),
  ];
  for (const file of candidates) {
    const text = await readFile(file, 'utf8').catch(() => undefined);
    if (text !== undefined) return { text, source: file };
  }
  return { text: DEFAULT_PROMPT, source: 'built-in default' };
}

export type Spawner = (command: string, args: string[], cwd: string) => Promise<number>;

/**
 * Finds an executable on PATH. Node cannot start `.cmd` shims without a shell (and we never build shell strings),
 * so on Windows only `.exe` files count; a lone `claude.cmd` gets an explanatory error.
 */
export async function resolveExecutable(
  name: string,
  platform: NodeJS.Platform = process.platform,
  pathEnv: string = process.env.PATH ?? '',
  has: (file: string) => Promise<boolean> = exists,
): Promise<string> {
  if (platform !== 'win32') return name;
  const dirs = pathEnv.split(path.win32.delimiter).filter(Boolean);
  for (const dir of dirs) if (await has(path.win32.join(dir, `${name}.exe`))) return path.win32.join(dir, `${name}.exe`);
  for (const dir of dirs) {
    if (await has(path.win32.join(dir, `${name}.cmd`))) {
      throw new Error(`Found ${name}.cmd but Node cannot start it safely. Install the native ${name}.exe build of Claude Code, or run the round from a terminal with \`${name} -p\`.`);
    }
  }
  throw new Error(`Could not find ${name}.exe on PATH. Is Claude Code installed?`);
}

const realSpawn: Spawner = async (command, args, cwd) => {
  const executable = await resolveExecutable(command);
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd, stdio: 'inherit' });
    child.on('error', (error) => reject(new Error(`Could not start \`${command}\`: ${error.message}. Is Claude Code installed and on your PATH?`)));
    child.on('close', (code) => resolve(code ?? 1));
  });
};

/** Minutes left on a fresh `.ai/session.lock`, or undefined when no session holds the repo. */
export function lockMinutesLeft(lockText: string | undefined, now: Date): number | undefined {
  const at = lockText === undefined ? undefined : parseLockTime(lockText);
  if (!at) return undefined;
  const left = LOCK_MINUTES - (now.getTime() - at.getTime()) / 60_000;
  return left > 0 ? Math.ceil(left) : undefined;
}

/** One `{"startedAt","endedAt"}` line per round in `.ai/runs.jsonl`; the dashboard's health checks read it. */
export async function recordRun(dir: string, startedAt: Date, endedAt: Date): Promise<void> {
  await mkdir(path.join(dir, '.ai'), { recursive: true });
  await appendFile(path.join(dir, '.ai', 'runs.jsonl'), `${JSON.stringify({ startedAt: startedAt.toISOString(), endedAt: endedAt.toISOString() })}\n`);
}

export interface RunResult {
  /** Why nothing ran, when the loop is already stopped. */
  skipped?: string;
  prompt: string;
  source: string;
  exitCode?: number;
}

/** `loop run`: one build round now, using the same prompt the scheduler uses. */
export async function runRound(
  dir: string,
  options: { dryRun: boolean; skipPermissions: boolean; model?: string },
  spawner: Spawner = realSpawn,
): Promise<RunResult> {
  const { text, source } = await loadPromptText(dir);
  const prompt = buildRunPrompt(text, { name: path.basename(path.resolve(dir)) });
  for (const stop of ['DONE.md', 'BLOCKED.md']) {
    if (await exists(path.join(dir, stop))) return { skipped: `${stop} exists: nothing to do`, prompt, source };
  }
  const lockLeft = lockMinutesLeft(await readFile(path.join(dir, '.ai', 'session.lock'), 'utf8').catch(() => undefined), new Date());
  if (lockLeft !== undefined) return { skipped: `another session holds .ai/session.lock (about ${lockLeft} min left): nothing to do`, prompt, source };
  if (options.dryRun) return { prompt, source };
  console.error(`Running one round in ${dir} (prompt: ${source})`);
  const startedAt = new Date();
  const exitCode = await spawner('claude', buildClaudeArgs(prompt, { skipPermissions: options.skipPermissions, ...(options.model && { model: options.model }) }), dir);
  await recordRun(dir, startedAt, new Date());
  return { prompt, source, exitCode };
}
