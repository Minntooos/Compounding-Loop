import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { lintBrief, type BriefLint } from '../core/brief.js';
import { buildDraftPrompt, draftClaudeArgs, extractOpenFindings, extractOutOfScope, nextRoundNumber } from '../core/draftBrief.js';
import { parseLanesConfig } from '../core/lanes.js';
import { parseSteer, steerPath, unacknowledged } from '../core/parse/steer.js';
import { extractNextItems } from '../core/rounds.js';
import { resolveInvocation } from './run.js';

export const DRAFT_FILE = '.ai/next-round.draft.md';

const read = (dir: string, rel: string) => readFile(path.join(dir, ...rel.split('/')), 'utf8').catch(() => undefined);

/** Runs `claude -p` with these arguments and returns what it printed. Injectable so tests never start Claude. */
export type ClaudeRunner = (args: string[], cwd: string) => Promise<string>;

export const realClaude: ClaudeRunner = async (rawArgs, cwd) => {
  const { command, args } = await resolveInvocation('claude', rawArgs);
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd, maxBuffer: 16 * 1024 * 1024, timeout: 15 * 60_000 }, (error, stdout) => {
      if (error) reject(new Error(`Could not run \`claude -p\`: ${error.message}. Is Claude Code installed, on your PATH and signed in? \`loop next-round --draft --print-prompt\` prints the prompt to paste yourself.`));
      else resolve(stdout);
    });
  });
};

export interface DraftOptions {
  /** Only build the prompt; never start Claude. */
  printPrompt?: boolean;
  /** Where the draft goes, relative to the repo (default `.ai/next-round.draft.md`). */
  out?: string;
  model?: string;
  claude?: ClaudeRunner;
}

export interface DraftResult {
  prompt: string;
  /** Absent with `printPrompt`. */
  draft?: string;
  outFile?: string;
  lint?: BriefLint;
}

/** Collects the ingredients: DONE.md next-10 lists, open audit findings, unacknowledged steer, the old out-of-scope. */
export async function gatherDraftPrompt(dir: string): Promise<string> {
  const idea = (await read(dir, 'IDEA.md')) ?? '';
  const lanes = parseLanesConfig((await read(dir, '.ai/lanes.json')) ?? '').config?.lanes.map((l) => l.name) ?? [];
  const next: { source: string; items: string[] }[] = [];
  for (const source of ['DONE.md', ...lanes.map((l) => `.ai/lanes/${l}/DONE.md`)]) {
    const items = extractNextItems((await read(dir, source)) ?? '');
    if (items.length) next.push({ source, items });
  }
  const findings = [];
  for (const file of (await readdir(path.join(dir, '.ai', 'audit')).catch(() => [] as string[])).filter((f) => f.endsWith('.md')).sort()) {
    findings.push(...extractOpenFindings(`.ai/audit/${file}`, (await read(dir, `.ai/audit/${file}`)) ?? ''));
  }
  const steer = [];
  for (const lane of lanes) {
    const entries = unacknowledged(parseSteer((await read(dir, steerPath(lane))) ?? ''));
    if (entries.length) steer.push({ lane, entries });
  }
  const name = path.basename(dir);
  return buildDraftPrompt({ name, round: nextRoundNumber(idea), next, findings, steer, outOfScope: extractOutOfScope(idea) });
}

/** `loop next-round --draft`: builds the prompt, runs `claude -p` through the usual runner, writes the draft and scores it. */
export async function runDraft(dir: string, options: DraftOptions = {}): Promise<DraftResult> {
  const prompt = await gatherDraftPrompt(dir);
  if (options.printPrompt) return { prompt };
  const draft = (await (options.claude ?? realClaude)(draftClaudeArgs(prompt, options.model), dir)).trim();
  if (!draft) throw new Error('Claude returned an empty draft. Run again, or use --print-prompt and paste the prompt into Claude Code yourself.');
  const rel = options.out ?? DRAFT_FILE;
  const outFile = path.resolve(dir, rel);
  await mkdir(path.dirname(outFile), { recursive: true });
  await writeFile(outFile, `${draft}\n`);
  return { prompt, draft, outFile, lint: lintBrief(draft) };
}
