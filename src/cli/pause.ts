import { execFile } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { formatPaused, PAUSED_FILE, parsePaused, type Paused } from '../core/parse/paused.js';
import { CONTROL_LANE } from '../core/lanes.js';

const execFileAsync = promisify(execFile);
export const git = (cwd: string, ...args: string[]) => execFileAsync('git', args, { cwd });

export interface PauseOptions {
  /** Who pauses; defaults to `git config user.name`. */
  as?: string;
  reason?: string;
  /** Push after committing (default true; tests pass false). */
  push?: boolean;
  now?: Date;
}

export interface PauseResult {
  /** True when this call changed the file. */
  changed: boolean;
  paused: boolean;
  by?: string;
  pushed?: boolean;
  pushError?: string;
}

const pausedFile = (dir: string) => path.join(dir, ...PAUSED_FILE.split('/'));

/** The current pause, or undefined when `.ai/PAUSED` is absent. */
export async function readPaused(dir: string): Promise<Paused | undefined> {
  const text = await readFile(pausedFile(dir), 'utf8').catch(() => undefined);
  return text === undefined ? undefined : parsePaused(text);
}

export async function pushIfWanted(dir: string, result: Pick<PauseResult, 'pushed' | 'pushError'>, push: boolean | undefined): Promise<void> {
  if (push === false) return;
  try {
    try {
      await git(dir, 'push');
    } catch {
      // Five lanes push to one branch, so a rejection is routine: rebase once and retry.
      await git(dir, 'pull', '--rebase', '--autostash', '-q');
      await git(dir, 'push');
    }
    result.pushed = true;
  } catch (error) {
    result.pushed = false;
    const lines = (error instanceof Error ? error.message : String(error)).split('\n').map((l) => l.trim()).filter(Boolean);
    result.pushError = lines.find((l) => /rejected|fatal|error:/i.test(l)) ?? lines[0] ?? 'git push failed';
  }
}

/** The dashboard writes PAUSED on GitHub, so look at the remote first. Offline or without a remote, the local view stands. */
export async function syncFirst(dir: string, push: boolean | undefined): Promise<void> {
  if (push === false) return;
  await git(dir, 'pull', '--rebase', '--autostash', '-q').catch(() => undefined);
}

/** `loop pause`: writes `.ai/PAUSED`, commits it with `Lane: control` and (by default) pushes. Pausing twice is a no-op. */
export async function runPause(dir: string, options: PauseOptions = {}): Promise<PauseResult> {
  await syncFirst(dir, options.push);
  const held = await readPaused(dir);
  if (held) return { changed: false, paused: true, by: held.by };
  const by = (options.as ?? (await git(dir, 'config', 'user.name').then((r) => r.stdout.trim(), () => ''))).trim();
  if (!by || by.includes('·') || /[\r\n]/.test(by)) throw new Error('Say who you are with --as <name> (git user.name is not set, or contains "·").');
  const reason = options.reason?.replace(/\s+/g, ' ').trim();
  await mkdir(path.dirname(pausedFile(dir)), { recursive: true });
  await writeFile(pausedFile(dir), formatPaused(by, options.now ?? new Date(), reason));
  try {
    await git(dir, 'add', '--', PAUSED_FILE);
    await git(dir, 'commit', '-qm', `Pause all lanes${reason ? `: ${reason}` : ''}\n\nLane: ${CONTROL_LANE}`, '--', PAUSED_FILE);
  } catch (error) {
    // An uncommitted PAUSED would look paused here while the lanes never see it.
    await git(dir, 'reset', '-q', '--', PAUSED_FILE).catch(() => undefined);
    await rm(pausedFile(dir), { force: true });
    throw error;
  }
  const result: PauseResult = { changed: true, paused: true, by };
  await pushIfWanted(dir, result, options.push);
  return result;
}

/** `loop resume`: removes `.ai/PAUSED` and commits that. Resuming a loop that is not paused is a no-op. */
export async function runResume(dir: string, options: Pick<PauseOptions, 'push'> = {}): Promise<PauseResult> {
  await syncFirst(dir, options.push);
  const tracked = (await git(dir, 'ls-files', '--', PAUSED_FILE)).stdout.trim() !== '';
  const present = (await readPaused(dir)) !== undefined;
  await rm(pausedFile(dir), { force: true });
  if (!tracked) return { changed: present, paused: false };
  await git(dir, 'add', '--', PAUSED_FILE);
  await git(dir, 'commit', '-qm', `Resume all lanes\n\nLane: ${CONTROL_LANE}`, '--', PAUSED_FILE);
  const result: PauseResult = { changed: true, paused: false };
  await pushIfWanted(dir, result, options.push);
  return result;
}
