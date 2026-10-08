import { spawn } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { browserCommand, runDashboard, serverShipped, type StartServer } from '../../../src/cli/dashboard.js';

describe('runDashboard', () => {
  const calls: unknown[] = [];
  const start: StartServer = async (options) => { calls.push(options); return { url: 'http://127.0.0.1:9', close: () => undefined }; };

  it('starts the server with the options and opens the browser', async () => {
    const opened: string[] = [];
    const lines: string[] = [];
    await runDashboard({ demo: true, port: 9, open: true, projectsDir: '.' }, { start, open: (u) => opened.push(u), log: (l) => lines.push(l) });
    expect(calls).toEqual([{ port: 9, demo: true, projectsDir: path.resolve('.') }]);
    expect(opened).toEqual(['http://127.0.0.1:9']);
    expect(lines).toEqual(['Dashboard (demo): http://127.0.0.1:9']);
  });

  it('does not open the browser with --no-open', async () => {
    const opened: string[] = [];
    await runDashboard({ demo: false, port: 9, open: false, projectsDir: '.' }, { start, open: (u) => opened.push(u), log: () => undefined });
    expect(opened).toEqual([]);
  });

  it('explains a busy port', async () => {
    const busy: StartServer = async () => { throw Object.assign(new Error('listen'), { code: 'EADDRINUSE' }); };
    await expect(runDashboard({ demo: false, port: 4321, open: false, projectsDir: '.' }, { start: busy })).rejects.toThrow(/already in use/);
  });

  it('rejects a bad port', async () => {
    await expect(runDashboard({ demo: false, port: 70000, open: false, projectsDir: '.' }, { start })).rejects.toThrow(/not a valid port/);
    await expect(runDashboard({ demo: false, port: Number('x'), open: false, projectsDir: '.' }, { start })).rejects.toThrow(/not a valid port/);
  });
});

describe('browserCommand', () => {
  it('uses an argument array per platform', () => {
    expect(browserCommand('http://x', 'darwin')).toEqual(['open', ['http://x']]);
    expect(browserCommand('http://x', 'linux')).toEqual(['xdg-open', ['http://x']]);
    expect(browserCommand('http://x', 'win32')[0]).toBe('rundll32');
  });
});

// Needs the server lane's startServer; skipped until src/server/index.ts exists.
describe.runIf(serverShipped(process.cwd()))('loop dashboard --demo --no-open (real server)', () => {
  it('starts and answers /api/health', async () => {
    const child = spawn(process.execPath, [path.resolve('node_modules/tsx/dist/cli.mjs'), path.resolve('src/cli/index.ts'), 'dashboard', '--demo', '--no-open', '--port', '0'], { stdio: ['ignore', 'pipe', 'inherit'] });
    try {
      const url = await new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('server did not start')), 15_000);
        child.stdout.on('data', (chunk: Buffer) => {
          const match = /(http:\/\/\S+)/.exec(chunk.toString());
          if (match?.[1]) { clearTimeout(timer); resolve(match[1]); }
        });
      });
      const health = (await (await fetch(`${url}/api/health`)).json()) as { ok: boolean; demo: boolean };
      expect(health).toMatchObject({ ok: true, demo: true });
    } finally {
      child.kill();
    }
  }, 30_000);
});
