import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

/** What `src/server/index.ts` exports (server lane contract, .ai/lanes/server/task.md). */
export interface ServerHandle {
  url: string;
  close: () => Promise<void> | void;
}
export type StartServer = (options: { port: number; demo: boolean; projectsDir: string }) => Promise<ServerHandle>;

export const DEFAULT_PORT = 4321;

/** Loads the server lazily so every other command works before (or without) the dashboard being built. */
async function loadStartServer(): Promise<StartServer> {
  const specifier = '../server/index.js';
  try {
    const mod = (await import(specifier)) as { startServer?: StartServer };
    if (typeof mod.startServer === 'function') return mod.startServer;
  } catch (error) {
    if (!(error instanceof Error) || !/Cannot find module|ERR_MODULE_NOT_FOUND/.test(error.message)) throw error;
  }
  throw new Error('The dashboard server is not available in this build (src/server/index.ts must export startServer).');
}

/** Command and arguments that open a URL in the default browser; always an argument array, never a shell string. */
export function browserCommand(url: string, platform: NodeJS.Platform = process.platform): [string, string[]] {
  if (platform === 'darwin') return ['open', [url]];
  if (platform === 'win32') return ['rundll32', ['url.dll,FileProtocolHandler', url]];
  return ['xdg-open', [url]];
}

function openBrowser(url: string): void {
  const [command, args] = browserCommand(url);
  // Best effort: a missing opener must not stop the server, the URL is printed anyway.
  execFile(command, args, () => undefined).on('error', () => undefined);
}

export interface DashboardOptions {
  demo: boolean;
  port: number;
  open: boolean;
  projectsDir: string;
}

export interface DashboardDeps {
  start?: StartServer;
  open?: (url: string) => void;
  log?: (line: string) => void;
}

/** Starts the local dashboard server and (unless told not to) opens the browser. */
export async function runDashboard(options: DashboardOptions, deps: DashboardDeps = {}): Promise<ServerHandle> {
  if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65535) {
    throw new Error(`"${options.port}" is not a valid port (0-65535).`);
  }
  const start = deps.start ?? (await loadStartServer());
  const server = await start({ port: options.port, demo: options.demo, projectsDir: path.resolve(options.projectsDir) });
  (deps.log ?? console.log)(`Dashboard${options.demo ? ' (demo)' : ''}: ${server.url}`);
  if (options.open) (deps.open ?? openBrowser)(server.url);
  return server;
}

/** True once the server lane has shipped `startServer`; lets tests run the real thing only when it exists. */
export const serverShipped = (root: string): boolean => existsSync(path.join(root, 'src', 'server', 'index.ts'));
