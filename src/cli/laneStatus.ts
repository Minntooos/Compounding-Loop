import { execFile } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { deriveLaneState, parseOutbox, summarizeOutboxes, type OutboxMessage } from '../core/laneStatus.js';
import { parseLanesConfig } from '../core/lanes.js';
import { parseLockTime, parseRunCounter } from '../core/repo.js';
import type { LaneStatus } from '../core/types.js';

const execFileAsync = promisify(execFile);
const read = (file: string) => readFile(file, 'utf8').catch(() => undefined);
const exists = (file: string) => stat(file).then(() => true, () => false);

async function lastCommitOf(dir: string, lane: string): Promise<LaneStatus['lastCommit']> {
  try {
    // Lane names are validated to [a-z0-9-], so they are safe inside the regex.
    const { stdout } = await execFileAsync('git', ['log', '-1', `--grep=^Lane: ${lane}$`, '--format=%H%x1f%s%x1f%cI'], {
      cwd: dir,
      env: { ...process.env, GIT_CEILING_DIRECTORIES: path.dirname(path.resolve(dir)) },
    });
    const [sha, subject, at] = stdout.trim().split('\u001f');
    return sha && subject !== undefined && at ? { sha, subject, at: new Date(at).toISOString() } : undefined;
  } catch {
    return undefined;
  }
}

/** One status per lane in `.ai/lanes.json`; undefined when the folder is not a laned loop. */
export async function readLaneStatuses(dir: string, now: Date = new Date()): Promise<LaneStatus[] | undefined> {
  const text = await read(path.join(dir, '.ai', 'lanes.json'));
  const config = text === undefined ? undefined : parseLanesConfig(text).config;
  if (!config) return undefined;
  const outboxes = new Map<string, OutboxMessage[]>();
  const partial = await Promise.all(config.lanes.map(async ({ name }) => {
    const laneDir = path.join(dir, '.ai', 'lanes', name);
    outboxes.set(name, parseOutbox(name, (await read(path.join(laneDir, 'outbox.md'))) ?? ''));
    const lockText = await read(path.join(laneDir, 'session.lock'));
    const lockAt = lockText === undefined ? undefined : parseLockTime(lockText);
    const lastCommit = await lastCommitOf(dir, name);
    const counter = parseRunCounter((await read(path.join(laneDir, 'task.md'))) ?? '');
    const state = deriveLaneState({
      hasDone: (await exists(path.join(laneDir, 'DONE.md'))) || (await exists(path.join(dir, 'DONE.md'))),
      hasBlocked: (await exists(path.join(laneDir, 'BLOCKED.md'))) || (await exists(path.join(dir, 'BLOCKED.md'))),
      ...(lockAt && { lockAt }),
      ...(lastCommit && { lastCommitAt: new Date(lastCommit.at) }),
    }, now);
    return { name, state, run: counter?.run ?? 0, limit: counter?.limit ?? 0, ...(lastCommit && { lastCommit }), locked: lockAt !== undefined && state === 'building' };
  }));
  const { unanswered, waitingOn } = summarizeOutboxes(outboxes);
  return partial.map((lane) => ({ ...lane, ...(waitingOn.has(lane.name) && { waitingOn: waitingOn.get(lane.name) as string[] }), unanswered: unanswered.get(lane.name) ?? [] }));
}
