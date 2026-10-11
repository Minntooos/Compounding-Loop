import { describe, expect, it } from 'vitest';
import { probeOrder } from '../../../web/src/lib/probe.js';

describe('probeOrder', () => {
  it('asks only the server on loopback, IP and single-label hosts', () => {
    for (const host of ['localhost', '127.0.0.1', '[::1]', '192.168.1.20', 'my-pc']) expect(probeOrder(host)).toEqual(['server']);
  });
  it('asks for the static export first on public domain names, then the server', () => {
    expect(probeOrder('minntooos.github.io')).toEqual(['static', 'server']);
    expect(probeOrder('loop.example.com')).toEqual(['static', 'server']);
  });
});
