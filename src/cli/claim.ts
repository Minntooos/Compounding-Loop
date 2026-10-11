import { execFile } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { parseLanesConfig } from '../core/lanes.js';
import { activeClaim, formatClaim } from '../core/parse/claim.js';

const execFileAsync = promisify(execFile);
const git = (cwd: string, ...args: string[]) => execFileAsync('git', args, { cwd });

export interface ClaimOptions {
  /** Who is claiming; defaults to `git config user.name`. */
  as?: string;
  minutes?: number;
  force?: boolean;
  /** Push after committing (default true; tests pass false). */
  push?: boolean;
  now?: Date;
}

export interface ClaimResult {
  lane: string;
  name: string;
  expiresAt?: Date;
  committed: boolean;
  pushed?: boolean;
  pushError?: string;
}

async function requireLane(dir: string, lane: string): Promise<void> {
  const text = await readFile(path.join(dir, '.ai', 'lanes.json'), 'utf8').catch(() => undefined);
  if (text === undefined) throw new Error('No .ai/lanes.json here. Create one with `loop init --lanes a,b,c`.');
  const { config, errors } = parseLanesConfig(text);
  if (!config) throw new Error(`.ai/lanes.json is invalid:\n- ${errors.join('\n- ')}`);
  if (!config.lanes.some((l) => l.name === lane)) throw new Error(`No lane "${lane}". Lanes here: ${config.lanes.map((l) => l.name).join(', ')}.`);
}

const claimPath = (lane: string) => `.ai/lanes/${lane}/claim`;
const readClaim = (dir: string, lane: string) => readFile(path.join(dir, ...claimPath(lane).split('/')), 'utf8').catch(() => undefined);

async function pushIfWanted(dir: string, result: ClaimResult, push: boolean | undefined): Promise<void> {
  if (push === false) return;
  try {
    try {
      await git(dir, 'push');
    } catch {
      // Five lanes push to one branch, so a rejection is routine: rebase once and retry.
      await git(dir, 'pull', '--rebase', '-q');
      await git(dir, 'push');
    }
    result.pushed = true;
  } catch (error) {
    result.pushed = false;
    const lines = (error instanceof Error ? error.message : String(error)).split('\n').map((l) => l.trim()).filter(Boolean);
    result.pushError = lines.find((l) => /rejected|fatal|error:/i.test(l)) ?? lines[0] ?? 'git push failed';
  }
}

async function commitTrailer(dir: string, lane: string, subject: string, file: string): Promise<void> {
  await git(dir, 'commit', '-qm', `${subject}\n\nLane: ${lane}`, '--', file);
}

/** Writes the claim file, commits it with a `Lane:` trailer and (by default) pushes. */
export async function runClaim(dir: string, lane: string, options: ClaimOptions = {}): Promise<ClaimResult> {
  await requireLane(dir, lane);
  const now = options.now ?? new Date();
  const minutes = options.minutes ?? 90;
  if (!Number.isFinite(minutes) || minutes <= 0) throw new Error('--minutes must be a positive number.');
  const name = (options.as ?? (await git(dir, 'config', 'user.name').then((r) => r.stdout.trim(), () => ''))).trim();
  if (!name || name.includes('·') || /[\r\n]/.test(name)) throw new Error('Say who you are with --as <name> (git user.name is not set, or contains "·").');

  const held = activeClaim(await readClaim(dir, lane), now);
  if (held && held.name.toLowerCase() !== name.toLowerCase() && !options.force) {
    throw new Error(`Lane "${lane}" is claimed by ${held.name} until ${held.expiresAt.toISOString()}. Pick another lane (\`loop next\`), wait, or pass --force.`);
  }
  const expiresAt = new Date(now.getTime() + minutes * 60_000);
  const file = path.join(dir, ...claimPath(lane).split('/'));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, formatClaim(name, expiresAt));
  await git(dir, 'add', '--', claimPath(lane));
  await commitTrailer(dir, lane, `${lane}: claimed by ${name} until ${expiresAt.toISOString()}`, claimPath(lane));
  const result: ClaimResult = { lane, name, expiresAt, committed: true };
  await pushIfWanted(dir, result, options.push);
  return result;
}

/** Removes the claim file and commits that. A lane without a claim is not an error. */
export async function runRelease(dir: string, lane: string, options: { push?: boolean } = {}): Promise<ClaimResult> {
  await requireLane(dir, lane);
  const text = await readClaim(dir, lane);
  if (text === undefined) return { lane, name: '', committed: false };
  const tracked = (await git(dir, 'ls-files', '--', claimPath(lane))).stdout.trim() !== '';
  await rm(path.join(dir, ...claimPath(lane).split('/')), { force: true });
  if (!tracked) return { lane, name: '', committed: false };
  await git(dir, 'add', '--', claimPath(lane));
  await commitTrailer(dir, lane, `${lane}: claim released`, claimPath(lane));
  const result: ClaimResult = { lane, name: '', committed: true };
  await pushIfWanted(dir, result, options.push);
  return result;
}
