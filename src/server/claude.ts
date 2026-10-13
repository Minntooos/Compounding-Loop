import { execFile } from 'node:child_process';
import { resolveInvocation } from '../cli/run.js';

/** A `ClaudeRunner` whose process can be stopped: aborting `signal` kills `claude` and rejects. */
export type AbortableClaude = (args: string[], cwd: string, signal?: AbortSignal) => Promise<string>;

export const abortableClaude: AbortableClaude = async (rawArgs, cwd, signal) => {
  const { command, args } = await resolveInvocation('claude', rawArgs);
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd, maxBuffer: 16 * 1024 * 1024, timeout: 15 * 60_000, ...(signal && { signal }) }, (error, stdout) => {
      if (!error) resolve(stdout);
      else if (signal?.aborted) reject(new Error('The draft was stopped.'));
      else reject(new Error(`Could not run \`claude -p\`: ${error.message}. Is Claude Code installed, on your PATH and signed in? \`loop next-round --draft --print-prompt\` prints the prompt to paste yourself.`));
    });
  });
};
