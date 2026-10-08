import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
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

const realSpawn: Spawner = (command, args, cwd) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' });
    child.on('error', (error) => reject(new Error(`Could not start \`${command}\`: ${error.message}. Is Claude Code installed and on your PATH?`)));
    child.on('close', (code) => resolve(code ?? 1));
  });

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
  if (options.dryRun) return { prompt, source };
  const exitCode = await spawner('claude', buildClaudeArgs(prompt, { skipPermissions: options.skipPermissions, ...(options.model && { model: options.model }) }), dir);
  return { prompt, source, exitCode };
}
