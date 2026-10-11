import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runCheckLanes } from '../../../src/cli/checkLanes.js';
import { runClaim, runRelease } from '../../../src/cli/claim.js';
import { activeClaim, formatClaim, parseClaim } from '../../../src/core/parse/claim.js';

describe('claim file format', () => {
  const at = new Date('2026-10-11T12:00:00.000Z');
  it('round-trips and treats malformed or expired claims as none', () => {
    expect(parseClaim(formatClaim('Ana B', at))).toEqual({ name: 'Ana B', expiresAt: at });
    expect(parseClaim('')).toBeUndefined();
    expect(parseClaim('Ana expires soon')).toBeUndefined();
    expect(parseClaim('Ana · expires not-a-date')).toBeUndefined();
    expect(activeClaim(formatClaim('Ana', at), new Date('2026-10-11T11:59:59Z'))?.name).toBe('Ana');
    expect(activeClaim(formatClaim('Ana', at), new Date('2026-10-11T12:00:00Z'))).toBeUndefined();
    expect(activeClaim(undefined)).toBeUndefined();
  });
  it('reads CRLF files', () => {
    expect(parseClaim(`Ana · expires ${at.toISOString()}\r\n`)?.name).toBe('Ana');
  });
});

describe('loop claim / release', () => {
  let dir: string;
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  const claimFile = (lane: string) => path.join(dir, '.ai', 'lanes', lane, 'claim');
  const now = new Date('2026-10-11T10:00:00Z');

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'loop-claim-'));
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 't@example.com');
    git('config', 'user.name', 'Tess');
    git('config', 'commit.gpgsign', 'false');
    await mkdir(path.join(dir, '.ai'));
    await writeFile(path.join(dir, '.ai', 'lanes.json'), JSON.stringify({
      lanes: [{ name: 'api', owns: ['src/api/**', '.ai/lanes/api/**'] }, { name: 'ui', owns: ['src/ui/**', '.ai/lanes/ui/**'] }],
      shared: [],
    }));
    git('add', '-A');
    git('commit', '-q', '-m', 'init\n\nLane: control');
  });
  afterEach(() => rm(dir, { recursive: true, force: true, maxRetries: 5 }));

  it('writes the claim, defaults the name to git user.name, commits with a Lane trailer', async () => {
    const r = await runClaim(dir, 'api', { push: false, now });
    expect(r.name).toBe('Tess');
    expect(await readFile(claimFile('api'), 'utf8')).toBe('Tess · expires 2026-10-11T11:30:00.000Z\n');
    expect(git('log', '-1', '--format=%B')).toContain('Lane: api');
    expect(git('status', '--porcelain')).toBe('');
  });

  it('honours --as and --minutes', async () => {
    await runClaim(dir, 'ui', { push: false, now, as: 'Sam', minutes: 10 });
    expect(await readFile(claimFile('ui'), 'utf8')).toBe('Sam · expires 2026-10-11T10:10:00.000Z\n');
  });

  it('refuses another person\'s unexpired claim, allows it after expiry, with --force, or for the same person', async () => {
    await runClaim(dir, 'api', { push: false, now, as: 'Sam' });
    await expect(runClaim(dir, 'api', { push: false, now: new Date('2026-10-11T10:30:00Z'), as: 'Ana' })).rejects.toThrow(/claimed by Sam/);
    await runClaim(dir, 'api', { push: false, now: new Date('2026-10-11T10:30:00Z'), as: 'Sam', minutes: 30 });
    await runClaim(dir, 'api', { push: false, now: new Date('2026-10-11T10:31:00Z'), as: 'Ana', force: true });
    expect((await readFile(claimFile('api'), 'utf8')).startsWith('Ana')).toBe(true);
    await runClaim(dir, 'api', { push: false, now: new Date('2026-10-11T13:00:00Z'), as: 'Zed' });
    expect((await readFile(claimFile('api'), 'utf8')).startsWith('Zed')).toBe(true);
  });

  it('rejects unknown lanes, bad minutes and missing names', async () => {
    await expect(runClaim(dir, 'nope', { push: false })).rejects.toThrow(/Lanes here: api, ui/);
    await expect(runClaim(dir, 'api', { push: false, minutes: 0 })).rejects.toThrow(/positive/);
    await expect(runClaim(dir, 'api', { push: false, as: 'a · b' })).rejects.toThrow(/--as/);
  });

  it('check-lanes accepts claim and release commits in their own lane', async () => {
    await runClaim(dir, 'api', { push: false, now });
    await runRelease(dir, 'api', { push: false });
    const result = await runCheckLanes(dir);
    expect(result.problems).toEqual([]);
    expect(result.untagged).toEqual([]);
  });

  it('release removes the claim and commits; releasing nothing is not an error', async () => {
    await runClaim(dir, 'api', { push: false, now });
    const r = await runRelease(dir, 'api', { push: false });
    expect(r.committed).toBe(true);
    expect(git('ls-files', '.ai/lanes/api')).toBe('');
    expect(git('log', '-1', '--format=%B')).toContain('Lane: api');
    expect((await runRelease(dir, 'api', { push: false })).committed).toBe(false);
  });

  it('is wired into the CLI (claim, then release, end to end)', () => {
    const run = (...args: string[]) => execFileSync(process.execPath, [path.resolve('node_modules/tsx/dist/cli.mjs'), path.resolve('src/cli/index.ts'), ...args, '--no-push', '--dir', dir], { encoding: 'utf8' });
    expect(run('claim', 'ui', '--as', 'Sam')).toMatch(/Claimed ui as Sam until/);
    expect(run('release', 'ui')).toMatch(/Released ui/);
  });

  it('treats names case-insensitively', async () => {
    await runClaim(dir, 'api', { push: false, now, as: 'Sam' });
    await runClaim(dir, 'api', { push: false, now, as: 'sam' });
  });

  it('reports a failed push without losing the commit', async () => {
    const r = await runClaim(dir, 'api', { now });
    expect(r.committed).toBe(true);
    expect(r.pushed).toBe(false);
    expect(r.pushError).toBeTruthy();
  });
});

describe('loop next', () => {
  it('lists this repo\'s lanes and recommends one, as JSON too', async () => {
    const { runNext } = await import('../../../src/cli/next.js');
    const report = await runNext(path.resolve('.'));
    expect(report.lanes.map((l) => l.name)).toEqual(['core', 'kit', 'server', 'web', 'docs']);
    for (const lane of report.lanes) expect(Array.isArray(lane.openUnits)).toBe(true);
    await expect(runNext(tmpdir())).rejects.toThrow(/lanes\.json/);
  });
});
