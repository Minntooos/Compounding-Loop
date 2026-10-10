import { spawn } from 'node:child_process';
import { appendFile, mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseLockTime } from '../core/repo.js';
import { LOCK_MINUTES } from '../core/status.js';
import { buildClaudeArgs, buildRunPrompt, DEFAULT_PROMPT } from '../core/runPrompt.js';
import { parseLanesConfig } from '../core/lanes.js';
import { packageRoot } from './init.js';
import { withSessionLock } from './lock.js';

const exists = (file: string) => stat(file).then(() => true, () => false);

/** First readable prompt: the repo's own, then the routine prompt in the repo, then the package's, then the built-in. */
export async function loadPromptText(dir: string, root: string = packageRoot, lane?: string): Promise<{ text: string; source: string }> {
  const candidates = [
    ...(lane ? [path.join(dir, '.ai', 'lanes', lane, 'prompt.md'), path.join(dir, 'runners', 'routine', 'lane-prompt.md'), path.join(root, 'runners', 'routine', 'lane-prompt.md')] : []),
    path.join(dir, '.ai', 'loop-prompt.md'),
    path.join(dir, 'runners', 'routine', 'prompt.md'),
    path.join(root, 'runners', 'routine', 'prompt.md'),
  ];
  for (const [index, file] of candidates.entries()) {
    const text = await readFile(file, 'utf8').catch(() => undefined);
    if (text === undefined) continue;
    // The first three candidates are written for a lane; any other prompt is generic and needs the intro.
    const forLane = lane !== undefined && index < 3;
    return { text: lane && !forLane ? `${laneIntro(lane)}\n\n${text}` : text, source: file };
  }
  return { text: lane ? `${laneIntro(lane)}\n\n${DEFAULT_PROMPT}` : DEFAULT_PROMPT, source: 'built-in default' };
}

/** Used when no lane prompt file exists: points the generic round prompt at this lane's files. */
export function laneIntro(lane: string): string {
  return `You are the **${lane}** lane of a multi-lane loop. Your lane's task file is \`.ai/lanes/${lane}/task.md\` (wherever this prompt says \`.ai/task.md\`, use it), your outbox is \`.ai/lanes/${lane}/outbox.md\`, your lock is \`.ai/lanes/${lane}/session.lock\`, and your stop files are \`.ai/lanes/${lane}/DONE.md\` and \`BLOCKED.md\`. Edit only the paths \`${lane}\` owns in \`.ai/lanes.json\` (plus shared ones), and end every commit message with the trailer line \`Lane: ${lane}\`.`;
}

/** Fails early, with the valid names, when `--lane` is not in `.ai/lanes.json`. */
export async function assertKnownLane(dir: string, lane: string): Promise<void> {
  const text = await readFile(path.join(dir, '.ai', 'lanes.json'), 'utf8').catch(() => undefined);
  if (text === undefined) throw new Error('No .ai/lanes.json here, so --lane has nothing to refer to. Run `loop init --lanes a,b,c` first, or drop --lane.');
  const { config, errors } = parseLanesConfig(text);
  if (!config) throw new Error(`.ai/lanes.json is invalid:\n- ${errors.join('\n- ')}`);
  if (!config.lanes.some((l) => l.name === lane)) throw new Error(`Unknown lane "${lane}". Lanes in .ai/lanes.json: ${config.lanes.map((l) => l.name).join(', ')}.`);
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
  if (/\.(?:cmd|bat)$/i.test(name)) throw new Error(`Node cannot start ${name} safely. Point at a native .exe instead.`);
  // A full path (e.g. process.execPath) needs no PATH search, and appending `.exe` would break it.
  if (path.win32.isAbsolute(name)) return name;
  const dirs = pathEnv.split(path.win32.delimiter).filter(Boolean);
  for (const dir of dirs) if (await has(path.win32.join(dir, `${name}.exe`))) return path.win32.join(dir, `${name}.exe`);
  for (const dir of dirs) {
    if (await has(path.win32.join(dir, `${name}.cmd`))) {
      throw new Error(`Found ${name}.cmd but Node cannot start it safely. Install the native ${name}.exe build of Claude Code, or run the round from a terminal with \`${name} -p\`.`);
    }
  }
  throw new Error(`Could not find ${name}.exe on PATH. Is Claude Code installed?`);
}

export interface Invocation {
  command: string;
  args: string[];
}

/**
 * Where an npm-installed `<name>.cmd` shim really points: the `bin` entry of the package installed next to it.
 * Returns undefined when the layout is not the usual global one.
 */
export async function shimEntry(
  shim: string,
  packageName: string,
  read: (file: string) => Promise<string | undefined> = (file) => readFile(file, 'utf8').catch(() => undefined),
): Promise<string | undefined> {
  const packageDir = path.win32.join(path.win32.dirname(shim), 'node_modules', ...packageName.split('/'));
  const text = await read(path.win32.join(packageDir, 'package.json'));
  if (text === undefined) return undefined;
  let bin: unknown;
  try {
    bin = (JSON.parse(text) as { bin?: unknown }).bin;
  } catch {
    return undefined;
  }
  const rel = typeof bin === 'string' ? bin : bin && typeof bin === 'object' ? Object.values(bin).find((v) => typeof v === 'string') : undefined;
  return typeof rel === 'string' ? path.win32.join(packageDir, rel) : undefined;
}

/**
 * Like `resolveExecutable`, but also copes with the usual Windows install (`npm i -g @anthropic-ai/claude-code`),
 * which only has `claude.cmd`: we run the package's own JS entry with this Node, no shell involved.
 */
export async function resolveInvocation(
  name: string,
  args: string[],
  platform: NodeJS.Platform = process.platform,
  pathEnv: string = process.env.PATH ?? '',
  has: (file: string) => Promise<boolean> = exists,
  read?: (file: string) => Promise<string | undefined>,
  nodePath: string = process.execPath,
): Promise<Invocation> {
  try {
    return { command: await resolveExecutable(name, platform, pathEnv, has), args };
  } catch (error) {
    if (platform !== 'win32' || path.win32.isAbsolute(name)) throw error;
    for (const dir of pathEnv.split(path.win32.delimiter).filter(Boolean)) {
      const shim = path.win32.join(dir, `${name}.cmd`);
      if (!(await has(shim))) continue;
      const entry = await shimEntry(shim, name === 'claude' ? '@anthropic-ai/claude-code' : name, read);
      if (!entry) throw error;
      return /\.exe$/i.test(entry) ? { command: entry, args } : { command: nodePath, args: [entry, ...args] };
    }
    throw error;
  }
}

const realSpawn: Spawner = async (command, rawArgs, cwd) => {
  const { command: executable, args } = await resolveInvocation(command, rawArgs);
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
  options: { dryRun: boolean; skipPermissions: boolean; model?: string; lane?: string },
  spawner: Spawner = realSpawn,
): Promise<RunResult> {
  const { lane } = options;
  if (lane) await assertKnownLane(dir, lane);
  const laneDir = lane ? path.join('.ai', 'lanes', lane) : '.ai';
  const { text, source } = await loadPromptText(dir, packageRoot, lane);
  const lockFile = path.join(dir, laneDir, 'session.lock');
  const lockNote = `Note from \`loop run\`: it created \`${path.posix.join(...laneDir.split(path.sep), 'session.lock')}\` for this very session. That lock is yours, not another session's: ignore it in the lock step and do not delete it.`;
  const prompt = `${buildRunPrompt(text, { name: path.basename(path.resolve(dir)), lane: lane ?? '' })}\n${lockNote}\n`;
  const stopFiles = [...(lane ? [path.join(laneDir, 'DONE.md'), path.join(laneDir, 'BLOCKED.md')] : []), 'DONE.md', 'BLOCKED.md'];
  for (const stop of stopFiles) {
    if (await exists(path.join(dir, stop))) return { skipped: `${stop} exists: nothing to do`, prompt, source };
  }
  const lockLeft = lockMinutesLeft(await readFile(lockFile, 'utf8').catch(() => undefined), new Date());
  if (lockLeft !== undefined) return { skipped: `another session holds ${path.join(laneDir, 'session.lock')} (about ${lockLeft} min left): nothing to do`, prompt, source };
  if (options.dryRun) return { prompt, source };
  console.error(`Running one round in ${dir}${lane ? ` as lane ${lane}` : ''} (prompt: ${source})`);
  const startedAt = new Date();
  try {
    const exitCode = await withSessionLock(lockFile, () =>
      spawner('claude', buildClaudeArgs(prompt, { skipPermissions: options.skipPermissions, ...(options.model && { model: options.model }) }), dir));
    return { prompt, source, exitCode };
  } finally {
    await recordRun(dir, startedAt, new Date()); // a failed round still counts for the dashboard's fast-failure check
  }
}
