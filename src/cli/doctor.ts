import { execFile } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { doctorPassed, evaluateDoctor, formatDoctor, type DoctorInput, type ProbeResult } from '../core/doctor.js';
import { resolveExecutable } from './run.js';

const execFileAsync = promisify(execFile);

/** Runs `command args` and reports success plus its first output; never throws. */
export async function probe(command: string, args: string[]): Promise<ProbeResult> {
  try {
    const { stdout, stderr } = await execFileAsync(await resolveExecutable(command), args, { timeout: 15_000 });
    return { ok: true, output: stdout.trim() || stderr.trim() };
  } catch (error) {
    return { ok: false, output: error instanceof Error ? error.message : String(error) };
  }
}

/** Folders where Playwright keeps downloaded browsers, most specific first. */
export function playwrightCacheDirs(env: NodeJS.ProcessEnv, platform: NodeJS.Platform, home: string): string[] {
  const custom = env.PLAYWRIGHT_BROWSERS_PATH;
  if (custom && custom !== '0') return [custom];
  if (platform === 'win32') return [path.win32.join(env.LOCALAPPDATA ?? path.win32.join(home, 'AppData', 'Local'), 'ms-playwright')];
  if (platform === 'darwin') return [path.posix.join(home, 'Library', 'Caches', 'ms-playwright')];
  return [path.posix.join(home, '.cache', 'ms-playwright'), '/opt/pw-browsers'];
}

export async function findChromium(
  dirs: string[],
  list: (dir: string) => Promise<string[]> = (dir) => readdir(dir),
): Promise<string | undefined> {
  for (const dir of dirs) {
    const found = (await list(dir).catch(() => [])).find((name) => /^chromium(?:_headless_shell)?-\d+$/.test(name));
    if (found) return path.join(dir, found);
  }
  return undefined;
}

export async function gatherDoctorInput(): Promise<DoctorInput> {
  const gh = await probe('gh', ['--version']);
  const [git, claude, ghAuth, chromium] = await Promise.all([
    probe('git', ['--version']),
    probe('claude', ['--version']),
    gh.ok ? probe('gh', ['auth', 'status']) : Promise.resolve<ProbeResult>({ ok: false, output: 'gh missing' }),
    findChromium(playwrightCacheDirs(process.env, process.platform, os.homedir())),
  ]);
  return { nodeVersion: process.version, git, gh, ghAuth, claude, chromium };
}

/** `loop doctor`: prints the report and returns whether every required tool is present. */
export async function runDoctor(gather: () => Promise<DoctorInput> = gatherDoctorInput): Promise<{ report: string; passed: boolean }> {
  const checks = evaluateDoctor(await gather());
  return { report: formatDoctor(checks), passed: doctorPassed(checks) };
}
