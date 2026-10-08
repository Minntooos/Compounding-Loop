import { execFile } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { runAnswer } from '../cli/loops.js';
import { parseBlocked } from '../core/blocked.js';
import { readLoopFacts, readRunCounter } from '../core/repo.js';
import { deriveStatus } from '../core/status.js';
import type { ContractItem, InboxItem, LoopCommit, LoopDetail } from '../core/types.js';
import { checkLoop } from './health.js';
import { sortByAttention, toSummary, type DataSource } from './data.js';

const execFileAsync = promisify(execFile);

async function readOptional(file: string): Promise<string | undefined> {
  return readFile(file, 'utf8').catch(() => undefined);
}

/** Recent commits of a clone, newest first. Empty when the folder is not a repo. */
export async function readTimeline(dir: string, limit = 50): Promise<LoopCommit[]> {
  try {
    const { stdout } = await execFileAsync('git', ['log', `-${limit}`, '--format=%h%x09%cI%x09%s'], {
      cwd: dir,
      env: { ...process.env, GIT_CEILING_DIRECTORIES: path.dirname(path.resolve(dir)) },
    });
    return stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [sha = '', at = '', ...message] = line.split('\t');
        return { sha, at: new Date(at).toISOString(), message: message.join('\t') };
      });
  } catch {
    return [];
  }
}

/** Bullet lines ("- x") directly under the first heading or bold label that matches `label`. */
export function bulletsUnder(markdown: string, label: RegExp): string[] {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((l) => label.test(l.replace(/^#+\s*|\*\*/g, '').trim()));
  if (start === -1) return [];
  const bullets: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#+\s/.test(line)) break;
    const bullet = /^\s*[-*]\s+(.*\S)\s*$/.exec(line);
    if (bullet?.[1]) bullets.push(bullet[1]);
    else if (bullets.length > 0 && line.trim() === '') break;
  }
  return bullets;
}

/** The done-when items of a task.md; an item only counts as passing once the loop wrote DONE.md. */
export function contractFromTask(taskText: string, finished: boolean): ContractItem[] {
  return bulletsUnder(taskText, /^done when/i).map((text) => ({ text, pass: finished }));
}

/** Reads one clone into the API's LoopDetail. `now` is a parameter so tests are deterministic. */
export async function readLoop(dir: string, now: Date = new Date()): Promise<LoopDetail> {
  const [baseFacts, counter, timeline, taskText] = await Promise.all([
    readLoopFacts(dir),
    readRunCounter(dir),
    readTimeline(dir),
    readOptional(path.join(dir, '.ai', 'task.md')),
  ]);
  // Any failing health check turns the loop "failing" with that check's reason (IDEA.md status rule 5).
  const checks = await checkLoop(dir, baseFacts, now);
  const facts = { ...baseFacts, healthFailures: checks.filter((c) => !c.ok).map((c) => c.reason) };
  const status = deriveStatus(facts, now);
  const round = facts.roundsDone + 1;
  const task = taskText ?? '';
  return {
    id: path.basename(dir),
    name: path.basename(dir),
    state: status.state,
    reason: status.reason,
    round,
    // The total is unknown for a real loop (the owner can always add a round), so it never reads "5 of 3".
    roundsTotal: round,
    run: counter?.run ?? 0,
    runLimit: counter?.limit ?? 0,
    ...(timeline[0] && { lastCommit: timeline[0] }),
    timeline,
    contract: contractFromTask(task, facts.hasDone),
    knowledge: bulletsUnder(task, /^confirmed/i),
    decisions: bulletsUnder(task, /^decisions/i),
    history: [],
  };
}

/** Subfolders of `projectsDir` that look like loop clones (a `.ai` folder). */
export async function findLoopDirs(projectsDir: string): Promise<string[]> {
  const entries = await readdir(projectsDir, { withFileTypes: true }).catch(() => []);
  const dirs: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const dir = path.join(projectsDir, entry.name);
    if ((await stat(path.join(dir, '.ai')).catch(() => undefined))?.isDirectory()) dirs.push(dir);
  }
  return dirs.sort();
}

async function readInboxItem(dir: string): Promise<InboxItem | undefined> {
  const file = path.join(dir, 'BLOCKED.md');
  const [text, info] = await Promise.all([readOptional(file), stat(file).catch(() => undefined)]);
  if (text === undefined || !info) return undefined;
  const note = parseBlocked(text);
  return { loopId: path.basename(dir), file: 'BLOCKED.md', question: note.question, bestGuess: note.bestGuess, since: info.mtime.toISOString() };
}

/** A DataSource over a folder of loop clones, re-read on every call so the dashboard is never stale. */
export function projectsSource(projectsDir: string, now: () => Date = () => new Date()): DataSource {
  const all = async () => Promise.all((await findLoopDirs(projectsDir)).map((dir) => readLoop(dir, now())));
  return {
    loops: async () => sortByAttention((await all()).map(toSummary)),
    // Match the id against folder names; never build a path from it.
    loop: async (id) => {
      const dir = (await findLoopDirs(projectsDir)).find((d) => path.basename(d) === id);
      return dir === undefined ? undefined : readLoop(dir, now());
    },
    inbox: async () => {
      const items = await Promise.all((await findLoopDirs(projectsDir)).map(readInboxItem));
      return items.filter((i): i is InboxItem => i !== undefined).sort((a, b) => a.since.localeCompare(b.since));
    },
    answer: async (id, answer) => {
      const dir = (await findLoopDirs(projectsDir)).find((d) => path.basename(d) === id);
      if (dir === undefined) return undefined;
      // runAnswer reads the exact word "accept" as "use the best guess"; the web form sends literal text only.
      const text = answer.trim();
      await runAnswer(dir, text === 'accept' ? 'Accept.' : text, { dryRun: false, now: now() });
      const commit = (await execFileAsync('git', ['rev-parse', '--short', 'HEAD'], { cwd: dir })).stdout.trim();
      // Best effort: a clone without a remote (or offline) keeps the commit and the loop pulls it later.
      const pushed = await execFileAsync('git', ['push'], { cwd: dir, timeout: 30_000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }).then(() => true, () => false);
      return { commit, pushed };
    },
    checks: async () => {
      const dirs = await findLoopDirs(projectsDir);
      const perLoop = await Promise.all(dirs.map(async (dir) => checkLoop(dir, await readLoopFacts(dir), now())));
      return perLoop.flat();
    },
  };
}
