import { rmSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface LockOptions {
  now?: () => Date;
  /** Called after Ctrl-C or SIGTERM once the lock is gone; defaults to `process.exit`. */
  exit?: (code: number) => void;
}

/**
 * Holds a session lock file (one UTC timestamp line) while `fn` runs, and removes it when `fn` succeeds, throws,
 * or the process gets Ctrl-C / SIGTERM, so a crashed round never blocks the next one for 90 minutes.
 */
export async function withSessionLock<T>(lockFile: string, fn: () => Promise<T>, options: LockOptions = {}): Promise<T> {
  const exit = options.exit ?? ((code: number) => process.exit(code));
  await mkdir(path.dirname(lockFile), { recursive: true });
  await writeFile(lockFile, `${(options.now ?? (() => new Date()))().toISOString()}\n`);
  const release = () => rmSync(lockFile, { force: true });
  const onSignal = (code: number) => () => { release(); exit(code); };
  const handlers = { SIGINT: onSignal(130), SIGTERM: onSignal(143), SIGHUP: onSignal(129) } as const;
  for (const [signal, handler] of Object.entries(handlers)) process.on(signal as NodeJS.Signals, handler);
  try {
    return await fn();
  } finally {
    for (const [signal, handler] of Object.entries(handlers)) process.off(signal as NodeJS.Signals, handler);
    release();
  }
}

