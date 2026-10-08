import { execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { findLoopDirs, readTimeline } from './loops.js';

const execFileAsync = promisify(execFile);

export type LoopEvent =
  | { type: 'loop-updated'; id: string }
  | { type: 'inbox-changed' }
  | { type: 'checks-changed' };

type Listener = (event: LoopEvent) => void;

/** A tiny in-process pub/sub; each SSE connection subscribes for its lifetime. */
export class EventBus {
  private readonly listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  emit(event: LoopEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  get size(): number {
    return this.listeners.size;
  }
}

const WATCHED_FILES = ['BLOCKED.md', 'DONE.md', path.join('.ai', 'session.lock'), path.join('.ai', 'task.md')];

/** A string that changes whenever a loop's HEAD or one of its status files changes. */
export async function fingerprint(dir: string): Promise<string> {
  const [head] = await readTimeline(dir, 1);
  // A `git fetch` only moves the upstream ref, so include it: the owner sees a push before pulling.
  const upstream = await execFileAsync('git', ['rev-parse', '--short', '@{u}'], { cwd: dir }).then((r) => r.stdout.trim(), () => 'no-upstream');
  const stamps = await Promise.all(
    WATCHED_FILES.map(async (file) => {
      const info = await stat(path.join(dir, file)).catch(() => undefined);
      return info ? `${file}:${info.mtimeMs}:${info.size}` : `${file}:-`;
    }),
  );
  return [head?.sha ?? 'no-commits', upstream, ...stamps].join('|');
}

export interface WatchOptions {
  /** How often to compare fingerprints. */
  intervalMs: number;
  /** How often to `git fetch` every clone; 0 turns fetching off (tests). */
  fetchIntervalMs: number;
}

export const DEFAULT_WATCH: WatchOptions = { intervalMs: 5_000, fetchIntervalMs: 5 * 60_000 };

/** Fetches quietly; a clone without a remote or network simply stays as it is. */
async function fetchClone(dir: string): Promise<void> {
  await execFileAsync('git', ['fetch', '--quiet'], { cwd: dir, timeout: 60_000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }).catch(() => undefined);
}

const FETCH_CONCURRENCY = 4;

/** Fetches every clone, a few at a time so many clones do not start many git processes at once. */
async function fetchAll(projectsDir: string): Promise<void> {
  const queue = await findLoopDirs(projectsDir);
  const worker = async (): Promise<void> => {
    for (let dir = queue.shift(); dir !== undefined; dir = queue.shift()) await fetchClone(dir);
  };
  await Promise.all(Array.from({ length: FETCH_CONCURRENCY }, worker));
}

/**
 * Polls every clone in `projectsDir` and emits events on change. Polling (not fs.watch) keeps it
 * identical on Windows, macOS and Linux and also sees commits made by `git pull`. Returns a stop function
 * that resolves once any poll already running has finished (on Windows a running `git` keeps the clone folder open).
 */
export function watchProjects(projectsDir: string, bus: EventBus, options: WatchOptions = DEFAULT_WATCH): () => Promise<void> {
  const seen = new Map<string, string>();
  const blocked = new Set<string>();
  let first = true;
  let running: Promise<void> | undefined;
  let stopped = false;

  const tick = (): Promise<void> => {
    if (running || stopped) return running ?? Promise.resolve();
    running = poll().finally(() => {
      running = undefined;
    });
    return running;
  };

  const poll = async (): Promise<void> => {
    const dirs = await findLoopDirs(projectsDir);
    const nowBlocked = new Set<string>();
    for (const dir of dirs) {
      const id = path.basename(dir);
      // One unreadable clone must not stop the others from being checked.
      const print = await fingerprint(dir).catch(() => seen.get(id) ?? 'unreadable');
      if (!print.includes('BLOCKED.md:-')) nowBlocked.add(id);
      if (!first && seen.get(id) !== print) bus.emit({ type: 'loop-updated', id });
      seen.set(id, print);
    }
    for (const id of [...seen.keys()]) if (!dirs.some((d) => path.basename(d) === id)) seen.delete(id);
    const inboxChanged = nowBlocked.size !== blocked.size || [...nowBlocked].some((id) => !blocked.has(id));
    blocked.clear();
    for (const id of nowBlocked) blocked.add(id);
    if (!first && inboxChanged) bus.emit({ type: 'inbox-changed' });
    first = false;
  };

  const timer = setInterval(() => void tick().catch(() => undefined), options.intervalMs);
  const fetcher =
    options.fetchIntervalMs > 0
      ? setInterval(() => void fetchAll(projectsDir).catch(() => undefined), options.fetchIntervalMs)
      : undefined;
  void tick().catch(() => undefined);
  return async () => {
    stopped = true;
    clearInterval(timer);
    if (fetcher) clearInterval(fetcher);
    await running?.catch(() => undefined);
  };
}
