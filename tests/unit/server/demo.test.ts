import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDemo, scrubText, toChecks, toLoopDetail } from '../../../demo/build-demo.mjs';
import type { DemoSnapshot } from '../../../src/core/types.js';

const root = path.resolve(import.meta.dirname, '..', '..', '..');
const referenceDir = path.join(root, '.ai', 'reference', 'five-sites');

async function readRaw(n: number) {
  return JSON.parse(await readFile(path.join(referenceDir, `proj${n}.json`), 'utf8')) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- raw report, only read in comparisons
}

async function readShipped(): Promise<DemoSnapshot> {
  return JSON.parse(await readFile(path.join(root, 'demo', 'five-sites.json'), 'utf8')) as DemoSnapshot;
}

describe('scrubText', () => {
  it('removes emails, local paths, key paths and ids', () => {
    expect(scrubText('mail me@example.com')).not.toContain('@');
    expect(scrubText('see /home/user/proj/x.ts now')).not.toContain('/home/');
    expect(scrubText('at C:\\Users\\me\\a.txt ok')).not.toContain('C:\\');
    expect(scrubText('key ~/.ssh/id_rsa here')).not.toContain('id_rsa');
    expect(scrubText('trig_01H4XjfhSgT9L7WyJuVE13jr')).not.toContain('trig_');
    expect(scrubText('session_01Wt6opZ8ePSDUTRWKrZQj5r')).not.toContain('session_');
  });

  it('leaves ordinary text alone', () => {
    expect(scrubText('Add /projector/ page')).toBe('Add /projector/ page');
  });
});

describe('shipped demo/five-sites.json', () => {
  it('is up to date with the builder', async () => {
    expect(await readShipped()).toEqual(await buildDemo(referenceDir));
  });

  it('has five loops', async () => {
    expect((await readShipped()).loops.map((l) => l.id)).toEqual(['proj1', 'proj2', 'proj3', 'proj4', 'proj5']);
  });

  it('contains no emails, local paths, key paths or session ids', async () => {
    const text = JSON.stringify(await readShipped());
    expect(text).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    expect(text).not.toMatch(/\/(?:home|Users|root|tmp)\//);
    expect(text).not.toMatch(/[A-Za-z]:\\\\/);
    expect(text).not.toMatch(/\.pem|id_rsa|id_ed25519|\.key\b/);
    expect(text).not.toMatch(/claude\.ai\/code\/routines|\.claude\/|~\//);
    expect(text).not.toMatch(/\b(?:session|trig|env|cse)_[A-Za-z0-9]{6,}/);
  });

  it('keeps pages, tests and rounds equal to the reference', async () => {
    const shipped = await readShipped();
    for (const [i, loop] of shipped.loops.entries()) {
      const raw = await readRaw(i + 1);
      expect(loop.pages).toBe(raw.pages.length);
      expect(loop.round).toBe(raw.round);
      expect(loop.roundsTotal).toBe(raw.maxRounds);
      expect(loop.tests).toEqual({
        passed: raw.tests.unitPassed + raw.tests.browserPassed,
        failed: raw.tests.unitFailed + raw.tests.browserFailed,
        at: raw.tests.ranAt,
      });
      expect(loop.timeline).toHaveLength(raw.commits.length);
    }
  });
});

describe('toLoopDetail / toChecks', () => {
  it('marks a finished report done with every contract item passing', async () => {
    const detail = toLoopDetail(await readRaw(1));
    expect(detail.state).toBe('done');
    expect(detail.contract.length).toBeGreaterThan(0);
    expect(detail.contract.every((c) => c.pass)).toBe(true);
    expect(detail.lastCommit).toEqual(detail.timeline[0]);
  });

  it('reports failing tests and leaks in the checks', async () => {
    const raw = await readRaw(1);
    raw.tests.unitFailed = 2;
    raw.live.leaked = ['TODO'];
    const checks = toChecks(raw);
    expect(checks.find((c) => c.kind === 'failing-tests')?.ok).toBe(false);
    expect(checks.find((c) => c.kind === 'leak')?.ok).toBe(false);
  });
});
