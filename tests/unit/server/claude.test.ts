import { describe, expect, it } from 'vitest';
import { abortableClaude } from '../../../src/server/claude.js';

describe('abortableClaude', () => {
  it('rejects with the stopped message when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(abortableClaude(['-p', 'hi'], process.cwd(), controller.signal)).rejects.toThrow(/stopped|Could not run/);
  });
});
