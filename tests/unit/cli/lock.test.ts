import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withSessionLock } from '../../../src/cli/lock.js';

describe('withSessionLock', () => {
  let dir: string;
  let file: string;
  beforeEach(async () => { dir = await mkdtemp(path.join(tmpdir(), 'loop-lock-')); file = path.join(dir, 'nested', 'session.lock'); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  it('writes a UTC timestamp, returns the result and removes the lock', async () => {
    const value = await withSessionLock(file, async () => (await readFile(file, 'utf8')).trim(), { now: () => new Date('2026-10-08T05:00:00Z') });
    expect(value).toBe('2026-10-08T05:00:00.000Z');
    await expect(readFile(file)).rejects.toThrow();
  });

  it('removes the lock when the work throws', async () => {
    await expect(withSessionLock(file, async () => { throw new Error('x'); })).rejects.toThrow('x');
    await expect(readFile(file)).rejects.toThrow();
  });

  it('removes the lock and exits on Ctrl-C and SIGTERM, then detaches its handlers', async () => {
    const before = process.listenerCount('SIGINT');
    for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143], ['SIGHUP', 129]] as const) {
      const exits: number[] = [];
      await withSessionLock(file, async () => {
        process.emit(signal);
        await expect(readFile(file)).rejects.toThrow();
      }, { exit: (c) => void exits.push(c) });
      expect(exits).toEqual([code]);
    }
    expect(process.listenerCount('SIGINT')).toBe(before);
  });
});
