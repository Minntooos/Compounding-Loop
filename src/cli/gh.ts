import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Gh } from '../core/gh.js';

const execFileAsync = promisify(execFile);

/** Runs a command and rethrows with its stderr, not the raw command line execFile puts in the message. */
async function run(command: string, args: string[], cwd: string): Promise<string> {
  try {
    return (await execFileAsync(command, args, { cwd })).stdout;
  } catch (error) {
    const stderr = (error as { stderr?: unknown }).stderr;
    const detail = typeof stderr === 'string' && stderr.trim() ? stderr.trim() : error instanceof Error ? error.message : String(error);
    throw new Error(`\`${command} ${args[0] ?? ''}\` failed: ${detail}`);
  }
}

/** Uses the user's own `gh` login; no token is read, stored or logged here. */
export const realGh: Gh = {
  async createRepoFromFolder(folder, name, options) {
    await run('git', ['init', '-q'], folder);
    await run('git', ['checkout', '-q', '-B', 'main'], folder);
    await run('git', ['add', '-A'], folder);
    // Fresh machines often have no git identity; fall back only when none is configured.
    const hasIdentity = await run('git', ['config', 'user.email'], folder).then((out) => out.trim() !== '', () => false);
    const identity = hasIdentity ? [] : ['-c', 'user.name=Compounding Loop', '-c', 'user.email=loop@users.noreply.github.com'];
    await run('git', [...identity, 'commit', '-qm', 'Start from the Compounding Loop template'], folder);
    await run('gh', ['repo', 'create', name, options.private ? '--private' : '--public', '--source', '.', '--push'], folder);
    return (await run('gh', ['repo', 'view', '--json', 'url', '--jq', '.url'], folder)).trim();
  },
};
