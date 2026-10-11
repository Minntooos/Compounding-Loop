import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildSelf, laneOfCommit, parseRun, SNAPSHOT_COMMIT } from '../../../demo/build-self.mjs';
import type { HealthCheck, LoopDetail } from '../../../src/core/types.js';

const root = path.resolve(import.meta.dirname, '..', '..', '..');
const readShipped = async () => JSON.parse(await readFile(path.join(root, 'demo', 'this-repo.json'), 'utf8')) as { loop: LoopDetail; checks: HealthCheck[] };
// A shallow clone (CI with fetch-depth 1) may lack the pinned commit or its ancestors, so the rebuild check is skipped there.
const hasHistory = (() => {
  try {
    execFileSync('git', ['cat-file', '-e', `${SNAPSHOT_COMMIT}^{commit}`], { cwd: root, stdio: 'ignore' });
    // A truncated history has the commit but not its ancestors, so the rebuilt timeline would differ.
    const shallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'], { cwd: root, encoding: 'utf8' }).trim();
    return shallow !== 'true';
  } catch {
    return false;
  }
})();

describe('parsers', () => {
  it('parseRun reads "Run: N / LIMIT"', () => {
    expect(parseRun('# x\n\nRun: 8 / 30\n')).toEqual({ run: 8, limit: 30 });
    expect(parseRun('nothing')).toEqual({ run: 0, limit: 0 });
  });

  it('laneOfCommit prefers the trailer, falls back to the subject prefix, ignores other prefixes', () => {
    expect(laneOfCommit('anything', 'body\n\nLane: web')).toBe('web');
    expect(laneOfCommit('kit: add x')).toBe('kit');
    expect(laneOfCommit('Release 0.1.0')).toBeUndefined();
    expect(laneOfCommit('fix: x')).toBeUndefined();
  });
});

describe('shipped demo/this-repo.json (the sixth demo loop)', () => {
  it('is the sixth loop with five finished lanes and the run counters from the lane files', async () => {
    const { loop } = await readShipped();
    expect(loop.name).toBe('compounding-loop (this repo)');
    expect(loop.lanes?.map((l) => [l.name, l.state])).toEqual([['core', 'done'], ['kit', 'done'], ['server', 'done'], ['web', 'done'], ['docs', 'done']]);
    // Totals over three rounds: 30 + 20 + 20 runs of budget per lane.
    expect(loop.lanes?.every((l) => l.limit === 70 && l.run > 0)).toBe(true);
    expect([loop.round, loop.roundsTotal, loop.state]).toEqual([3, 4, 'done']);
    expect(loop.reason).toMatch(/rounds 1 to 3/);
  });

  it('keeps the full history up to the pin, newest first, and says when the snapshot was taken (regression: it stopped at 100 commits)', async () => {
    const { loop } = await readShipped();
    expect(loop.timeline.length).toBeGreaterThan(100);
    expect(new Set(loop.timeline.map((c) => c.sha)).size).toBe(loop.timeline.length);
    expect(loop.timeline[0]?.sha).toBe(SNAPSHOT_COMMIT);
    expect(loop.snapshotAt).toBe(loop.timeline[0]?.at);
    expect(loop.timeline.map((c) => c.at)).toEqual(loop.timeline.map((c) => c.at).sort().reverse());
    // Round 1 (the oldest day) is present, which the 100-commit cap used to cut off.
    expect(loop.timeline.at(-1)?.at.slice(0, 10)).toBe('2026-10-05');
    expect(loop.timeline.every((c) => c.author === undefined || (c.author !== '' && !c.author.includes('@')))).toBe(true);
  });

  it('contains no emails, local paths, tokens, routine or session ids, or author emails', async () => {
    const text = JSON.stringify(await readShipped());
    expect(text).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    expect(text).not.toMatch(/\/(?:home|Users|root|tmp)\//);
    expect(text).not.toMatch(/[A-Za-z]:\\\\/);
    expect(text).not.toMatch(/\.pem|id_rsa|id_ed25519|\.key\b|~\/|\.claude\//);
    expect(text).not.toMatch(/\b(?:session|trig|env|cse)_[A-Za-z0-9]{6,}/);
    expect(text).not.toMatch(/\b(?:ghp|gho|ghs|github_pat|sk)[-_][A-Za-z0-9_]{10,}/);
    expect(text).not.toMatch(/routines?\/|claude\.ai/i);
    expect(text).not.toMatch(/fbmontassar/i);
  });

  it.skipIf(!hasHistory)('is up to date with the builder', async () => {
    expect(await readShipped()).toEqual(await buildSelf(root));
  });
});
