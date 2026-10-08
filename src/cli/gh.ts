import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Gh } from '../core/gh.js';

const execFileAsync = promisify(execFile);

/** Uses the user's own `gh` login; no token is read, stored or logged here. */
export const realGh: Gh = {
  async createRepoFromFolder(folder, name, options) {
    const git = (...args: string[]) => execFileAsync('git', args, { cwd: folder });
    await git('init', '-q', '-b', 'main');
    await git('add', '-A');
    await git('commit', '-qm', 'Start from the Compounding Loop template');
    const visibility = options.private ? '--private' : '--public';
    await execFileAsync('gh', ['repo', 'create', name, visibility, '--source', '.', '--push'], { cwd: folder });
    const { stdout } = await execFileAsync('gh', ['repo', 'view', '--json', 'url', '--jq', '.url'], { cwd: folder });
    return stdout.trim();
  },
};
