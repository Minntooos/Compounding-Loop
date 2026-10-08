import { execFile } from 'node:child_process';
import path from 'node:path';
import type { DashboardSettings } from '../core/types.js';

export const DEFAULT_RUNNER: DashboardSettings['defaultRunner'] = 'routine';

const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

/** Reads a `gh` login from command output; anything that is not a plain GitHub user name counts as none. */
export function parseGhLogin(stdout: string): string | undefined {
  const login = stdout.trim();
  return LOGIN.test(login) ? login : undefined;
}

/** The signed-in `gh` account, or undefined when `gh` is missing, signed out or slow. Uses the user's own `gh` login; no token is read. */
export function ghLogin(): Promise<string | undefined> {
  return new Promise((resolve) => {
    execFile('gh', ['api', 'user', '--jq', '.login'], { timeout: 5000, windowsHide: true }, (error, stdout) => {
      resolve(error ? undefined : parseGhLogin(stdout));
    });
  });
}

/** Settings for `GET /api/settings`; demo mode reveals nothing about this machine. */
export async function dashboardSettings(
  options: { demo: boolean; projectsDir?: string },
  lookupGh: () => Promise<string | undefined> = ghLogin,
): Promise<DashboardSettings> {
  if (options.demo) return { demo: true, defaultRunner: DEFAULT_RUNNER };
  const ghAccount = await lookupGh();
  return { demo: false, projectsDir: path.resolve(options.projectsDir ?? process.cwd()), ...(ghAccount && { ghAccount }), defaultRunner: DEFAULT_RUNNER };
}
