import { execFile } from 'node:child_process';
import { readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { addAnswerToTask, formatAnswer, parseBlocked } from '../core/blocked.js';
import { readLoopFacts, readRunCounter } from '../core/repo.js';
import { buildNextRoundTask, extractNextItems, nextDoneFileName } from '../core/rounds.js';
import { formatFleet, type FleetRow } from '../core/table.js';

const execFileAsync = promisify(execFile);
const git = (cwd: string, ...args: string[]) => execFileAsync('git', args, { cwd });

/** `loop status`: one row per folder. */
export async function runStatus(dirs: string[], now: Date = new Date()): Promise<string> {
  const rows: FleetRow[] = [];
  for (const dir of dirs) {
    const run = await readRunCounter(dir);
    rows.push({ name: path.basename(path.resolve(dir)), facts: await readLoopFacts(dir), ...(run && { run }) });
  }
  return formatFleet(rows, now);
}

export interface NextRoundResult {
  archivedAs: string;
  units: number;
}

/** `loop next-round`: archive DONE.md as `.ai/done-vN.md` and write the next task.md from its "next 10" list. */
export async function runNextRound(dir: string, options: { dryRun: boolean }): Promise<NextRoundResult> {
  const donePath = path.join(dir, 'DONE.md');
  const doneText = await readFile(donePath, 'utf8').catch(() => undefined);
  if (doneText === undefined) throw new Error('No DONE.md here: this loop has not finished a round.');
  const items = extractNextItems(doneText);
  if (items.length === 0) throw new Error('DONE.md has no "next 10" list to turn into the next round.');
  const aiDir = path.join(dir, '.ai');
  const archivedAs = nextDoneFileName(await readdir(aiDir).catch(() => []));
  const round = Number(/\d+/.exec(archivedAs)?.[0] ?? '1') + 1;
  const previous = await readRunCounter(dir);
  if (!options.dryRun) {
    await rename(donePath, path.join(aiDir, archivedAs));
    await writeFile(path.join(aiDir, 'task.md'), buildNextRoundTask(items, round, previous?.limit));
    await rm(path.join(aiDir, 'session.lock'), { force: true });
  }
  return { archivedAs, units: items.length };
}

export interface AnswerResult {
  question: string;
  bestGuess: string;
  /** The text that was (or would be) recorded. */
  answer: string;
}

/** `loop answer`: record the owner's answer in task.md, remove BLOCKED.md, and commit so the next run restarts. */
export async function runAnswer(
  dir: string,
  answer: string | 'accept',
  options: { dryRun: boolean; now?: Date },
): Promise<AnswerResult> {
  const blockedPath = path.join(dir, 'BLOCKED.md');
  const text = await readFile(blockedPath, 'utf8').catch(() => undefined);
  if (text === undefined) throw new Error('No BLOCKED.md here: nothing to answer.');
  const note = parseBlocked(text);
  const finalAnswer = answer === 'accept' ? note.bestGuess : answer;
  if (!finalAnswer.trim()) throw new Error('BLOCKED.md has no best guess to accept; pass an answer instead.');
  if (!options.dryRun) {
    const taskPath = path.join(dir, '.ai', 'task.md');
    const task = await readFile(taskPath, 'utf8').catch(() => '');
    const date = (options.now ?? new Date()).toISOString().slice(0, 10);
    await writeFile(taskPath, addAnswerToTask(task, formatAnswer(note, finalAnswer, date)));
    await rm(blockedPath);
    await git(dir, 'add', '-A');
    await git(dir, '-c', 'user.name=Compounding Loop', '-c', 'user.email=loop@users.noreply.github.com', 'commit', '-qm', 'Answer BLOCKED.md and restart the loop');
  }
  return { question: note.question, bestGuess: note.bestGuess, answer: finalAnswer };
}
