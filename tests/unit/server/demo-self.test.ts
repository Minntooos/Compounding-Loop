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
  it('is the sixth loop: a round 5 in progress, five lanes with the run counters from the lane files', async () => {
    const { loop } = await readShipped();
    expect(loop.name).toBe('compounding-loop (this repo)');
    expect(loop.lanes?.map((l) => [l.name, l.state])).toEqual([['core', 'done'], ['kit', 'done'], ['server', 'building'], ['web', 'building'], ['docs', 'waiting']]);
    // Totals over three rounds: 30 + 20 + 20 runs of budget per lane.
    expect(loop.lanes?.every((l) => l.limit === 70 && l.run > 0)).toBe(true);
    expect([loop.round, loop.roundsTotal, loop.state]).toEqual([5, 5, 'building']);
    expect(loop.roundLabel).toBe('Round 5 · building');
    // The header agrees with the run data it carries: not finished, and the contract is not all passing.
    expect(loop.contract.some((c) => !c.pass)).toBe(true);
  });

  it('keeps the full history up to the pin, newest first, and says when the snapshot was taken (regression: it stopped at 100 commits)', async () => {
    const { loop } = await readShipped();
    expect(loop.timeline.length).toBeGreaterThan(100);
    expect(new Set(loop.timeline.map((c) => c.sha)).size).toBe(loop.timeline.length);
    // The pinned history (up to the 0.3.0 commit) sits under round 5's commits of the snapshot day.
    expect(loop.timeline.some((c) => c.sha === SNAPSHOT_COMMIT)).toBe(true);
    expect(loop.timeline[0]?.at.slice(0, 10)).toBe('2026-10-13');
    expect(loop.snapshotAt).toBe('2026-10-13T12:40:00.000Z');
    expect(loop.timeline.map((c) => c.at)).toEqual(loop.timeline.map((c) => c.at).sort().reverse());
    // Round 1 (the oldest day) is present, which the 100-commit cap used to cut off.
    expect(loop.timeline.at(-1)?.at.slice(0, 10)).toBe('2026-10-05');
    expect(loop.timeline.every((c) => c.author === undefined || (c.author !== '' && !c.author.includes('@')))).toBe(true);
  });

  it('agrees with its own run data: the snapshot day has commits, lane cards point at them, open done-whens and a CI status exist', async () => {
    const { loop } = await readShipped();
    const today = loop.timeline.filter((c) => c.at.slice(0, 10) === '2026-10-13');
    expect(today.length).toBeGreaterThan(20);
    expect(new Set(today.map((c) => c.lane))).toEqual(new Set(['core', 'kit', 'server', 'web', 'control']));
    expect(loop.timeline.every((c) => c.at <= loop.snapshotAt!)).toBe(true);
    expect(loop.lastCommit).toEqual(loop.timeline[0]);
    for (const lane of loop.lanes ?? []) {
      const last = loop.timeline.find((c) => c.lane === lane.name);
      if (last) expect(lane.lastCommit?.sha).toBe(last.sha);
    }
    const contracts = (loop.laneNotes ?? []).flatMap((n) => n.contract);
    expect(contracts.some((c) => c.pass)).toBe(true);
    expect(contracts.some((c) => !c.pass)).toBe(true);
    expect(loop.ci?.ok).toBe(true);
  });

  it('tags every commit with a lane and groups each lane\'s contract and decisions', async () => {
    const { loop } = await readShipped();
    expect(loop.timeline.every((c) => typeof c.lane === 'string')).toBe(true);
    expect(loop.timeline.find((c) => /^Release 0\.\d/.test(c.message))?.lane).toMatch(/^(release|control)$/);
    expect(loop.laneNotes?.map((n) => n.lane)).toEqual(['core', 'kit', 'server', 'web', 'docs']);
    expect(loop.laneNotes?.every((n) => n.contract.length > 0)).toBe(true);
    expect(loop.laneNotes?.some((n) => n.decisions.length > 0)).toBe(true);
  });

  it('carries run-log, schedule and steer fixtures that exercise every outcome web shows', async () => {
    const { loop } = await readShipped();
    expect(new Set(loop.runs?.map((r) => r.outcome))).toEqual(new Set(['pushed', 'nothing-pushed', 'no-run-recorded']));
    expect(loop.runOutcomes).toMatchObject({ limitStops5h: 2, running: ['web'], sleeping: ['docs'], routinesLookOff: false });
    expect(loop.runOutcomes?.nextDue).toEqual({ lane: 'server', at: '2026-10-13T13:25:00.000Z' });
    expect(loop.schedule?.lanes.docs?.sleeping).toBe(true);
    expect(loop.idleRuns).toEqual({ core: 0, kit: 0, server: 0, web: 0, docs: 3 });
    const steer = Object.fromEntries((loop.steer ?? []).map((s) => [s.lane, s.entries]));
    // Acknowledged (done and not-done), open next-run and open standing entries are all present.
    const all = Object.values(steer).flat();
    expect(all.some((e) => e.ack?.state === 'done')).toBe(true);
    expect(all.some((e) => e.ack?.state === 'not-done')).toBe(true);
    expect(all.some((e) => !e.ack && e.scope === 'next-run')).toBe(true);
    expect(all.some((e) => !e.ack && e.scope === 'standing')).toBe(true);
    expect(loop.reason).not.toMatch(/round 4/);
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
