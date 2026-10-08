import { describe, expect, it } from 'vitest';
import { formatFleet } from '../../../src/core/table.js';

const now = new Date('2026-10-08T12:00:00Z');
const facts = { hasBlocked: false, hasDone: false, roundsDone: 0, healthFailures: [] };

describe('formatFleet', () => {
  it('says nothing needs you for quiet loops', () => {
    const out = formatFleet([{ name: 'a', facts }], now);
    expect(out.split('\n')[0]).toBe('Nothing needs you.');
    expect(out).toContain('. waiting');
  });
  it('lists blocked loops first and counts them', () => {
    const out = formatFleet([{ name: 'a', facts }, { name: 'b', facts: { ...facts, hasBlocked: true }, run: { run: 3, limit: 30 } }], now);
    const lines = out.split('\n');
    expect(lines[0]).toBe('1 loop needs you.');
    expect(lines[3]).toMatch(/^b\s+! blocked\s+round 1\s+run 3\/30/);
    expect(lines[4]).toMatch(/^a /);
  });
});
