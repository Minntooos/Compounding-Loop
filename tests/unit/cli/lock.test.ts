import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withSessionLock } from '../../../src/cli/lock.js';

describe('withSessionLock', () => {
  let dir: string;
  let file: string;
  beforeEach(async () => { dir = await mkdtemp(path.join(tmpdir(), 'loop-lock-')); file = path.join(dir, 'nested', 'session.lock'); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true, maxRetries: 5 }); });

  it('writes a UTC timestamp, returns the result and removes the lock', async () => {
    const value = await withSessionLock(file, async () => (await readFile(file, 'utf8')).trim(), { now: () => new Date('2026-10-08T05:00:00Z') });
    expect(value).toBe('2026-10-08T05:00:00.000Z');
    await expect(readFile(file)).rejects.toThrow();
  });

  it('removes the lock when the work throws', async () => {
    await expect(withSessionLock(file, async () => { throw new Error('x'); })).rejects.toThrow('x');
    await expect(readFile(file)).rejects.toThrow();
  });

  it('keeps the lock until the work settles after Ctrl-C / SIGTERM / SIGHUP, then exits and detaches its handlers', async () => {
    const before = process.listenerCount('SIGINT');
    for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143], ['SIGHUP', 129]] as const) {
      const exits: number[] = [];
      await withSessionLock(file, async () => {
        process.emit(signal);
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect((await readFile(file, 'utf8')).length).toBeGreaterThan(0);
      }, { exit: (c) => void exits.push(c) });
      await new Promise((resolve) => setTimeout(resolve, 20));
      await expect(readFile(file)).rejects.toThrow();
      expect(exits.length).toBe(1);
      expect(exits[0]).toBe(code);
    }
    expect(process.listenerCount('SIGINT')).toBe(before);
  });

  it('releases the lock after the grace period when the work hangs', async () => {
    const exits: number[] = [];
    let release = (): void => undefined;
    const hanging = withSessionLock(file, () => new Promise<void>((resolve) => { release = resolve; process.emit('SIGINT'); }), { graceMs: 30, exit: (c) => void exits.push(c) });
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(exits).toEqual([130]);
    await expect(readFile(file)).rejects.toThrow();
    release();
    await hanging;
  });
});
