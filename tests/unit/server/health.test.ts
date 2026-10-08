import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  checkLoop, deployLeakCheck, failingTestsCheck, leakCheck, rootPublishers, parseRunLog, parseTestRecord, runnerSilentCheck, shortRunsCheck, staleLockCheck,
} from '../../../src/server/health.js';

const now = new Date('2026-10-08T12:00:00Z');
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);
const run = (seconds: number) => ({ startedAt: now, endedAt: new Date(now.getTime() + seconds * 1000) });

describe('leakCheck', () => {
  it('passes without netlify.toml or with a subfolder', () => {
    expect(leakCheck(undefined).ok).toBe(true);
    expect(leakCheck('[build]\n  publish = "site"\n').ok).toBe(true);
  });

  it('treats a missing publish folder as unknown, not a leak', () => {
    expect(leakCheck('[[headers]]\n for = "/*"\n').ok).toBe(true);
  });

  it('fails when the repo root is published or publish is missing', () => {
    for (const toml of ['[build]\n publish = "."\n', "[build]\n publish = './'\n", '[build]\n publish = ""\n']) {
      const check = leakCheck(toml);
      expect(check.ok, toml).toBe(false);
      expect(check.reason).toContain('public');
    }
  });
});

describe('staleLockCheck', () => {
  it('passes with no lock and with a fresh lock', () => {
    expect(staleLockCheck({}, now).ok).toBe(true);
    expect(staleLockCheck({ lockAt: minutesAgo(10) }, now).ok).toBe(true);
  });

  it('fails when an old lock has no commit after it', () => {
    expect(staleLockCheck({ lockAt: minutesAgo(120) }, now).ok).toBe(false);
    expect(staleLockCheck({ lockAt: minutesAgo(120), lastCommitAt: minutesAgo(200) }, now).ok).toBe(false);
  });

  it('ignores an old lock on a blocked or done loop', () => {
    expect(staleLockCheck({ lockAt: minutesAgo(600), hasBlocked: true }, now).ok).toBe(true);
    expect(staleLockCheck({ lockAt: minutesAgo(600), hasDone: true }, now).ok).toBe(true);
  });

  it('passes when work was committed after the lock was taken', () => {
    expect(staleLockCheck({ lockAt: minutesAgo(120), lastCommitAt: minutesAgo(30) }, now).ok).toBe(true);
  });
});

describe('shortRunsCheck', () => {
  it('passes with no log or with real work', () => {
    expect(shortRunsCheck([]).ok).toBe(true);
    expect(shortRunsCheck([run(1), run(1), run(600)]).ok).toBe(true);
  });

  it('fails after three runs in a row that ended in about a second', () => {
    const check = shortRunsCheck([run(900), run(1), run(1.2), run(0.8)]);
    expect(check.ok).toBe(false);
    expect(check.proof).toContain('1.0 s');
  });

  it('needs the whole streak', () => {
    expect(shortRunsCheck([run(1), run(1)]).ok).toBe(true);
  });
});

describe('parseRunLog / parseTestRecord', () => {
  it('skips bad lines and sorts by start time', () => {
    const text = [
      '{"startedAt":"2026-10-08T02:00:00Z","endedAt":"2026-10-08T02:00:01Z"}',
      'garbage',
      '{"startedAt":"2026-10-08T01:00:00Z","endedAt":"nope"}',
      '{"startedAt":"2026-10-08T01:00:00Z","endedAt":"2026-10-08T01:30:00Z"}',
    ].join('\n');
    const runs = parseRunLog(text);
    expect(runs).toHaveLength(2);
    expect(runs[0]?.startedAt.toISOString()).toBe('2026-10-08T01:00:00.000Z');
  });

  it('parses a test record or returns undefined', () => {
    expect(parseTestRecord('{"passed":3,"failed":1}')).toEqual({ passed: 3, failed: 1 });
    expect(parseTestRecord('{"passed":"3"}')).toBeUndefined();
    expect(parseTestRecord('nope')).toBeUndefined();
  });
});

describe('failingTestsCheck', () => {
  it('passes with no record or no failures, fails otherwise', () => {
    expect(failingTestsCheck(undefined).ok).toBe(true);
    expect(failingTestsCheck({ passed: 5, failed: 0 }).ok).toBe(true);
    const bad = failingTestsCheck({ passed: 5, failed: 2 });
    expect(bad.ok).toBe(false);
    expect(bad.reason).toBe('2 tests fail');
  });
});

describe('runnerSilentCheck', () => {
  const base = { hasBlocked: false, hasDone: false };

  it('passes while commits are inside two periods, fails after', () => {
    expect(runnerSilentCheck({ ...base, lastCommitAt: minutesAgo(110) }, now).ok).toBe(true);
    const silent = runnerSilentCheck({ ...base, lastCommitAt: minutesAgo(150) }, now);
    expect(silent.ok).toBe(false);
    expect(silent.reason).toContain('limit 120');
  });

  it('uses the given cron period', () => {
    expect(runnerSilentCheck({ ...base, lastCommitAt: minutesAgo(150) }, now, 120).ok).toBe(true);
  });

  it('counts a recent lock as activity', () => {
    expect(runnerSilentCheck({ ...base, lastCommitAt: minutesAgo(500), lockAt: minutesAgo(5) }, now).ok).toBe(true);
  });

  it('does not complain about a loop stopped on purpose or one with no history', () => {
    expect(runnerSilentCheck({ hasBlocked: true, hasDone: false, lastCommitAt: minutesAgo(900) }, now).ok).toBe(true);
    expect(runnerSilentCheck({ hasBlocked: false, hasDone: true, lastCommitAt: minutesAgo(900) }, now).ok).toBe(true);
    expect(runnerSilentCheck(base, now).ok).toBe(true);
  });
});

describe('checkLoop', () => {
  it('reads the files and returns five checks tagged with the loop id', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'cl-health-'));
    try {
      mkdirSync(path.join(dir, '.ai'));
      writeFileSync(path.join(dir, 'netlify.toml'), '[build]\n publish = "."\n');
      writeFileSync(path.join(dir, '.ai', 'last-test.json'), '{"passed":1,"failed":3}');
      const checks = await checkLoop(dir, { hasBlocked: false, hasDone: false, roundsDone: 0, healthFailures: [] }, now);
      expect(checks.map((c) => c.kind)).toEqual(['leak', 'stale-lock', 'short-runs', 'failing-tests', 'runner-silent']);
      expect(new Set(checks.map((c) => c.loopId))).toEqual(new Set([path.basename(dir)]));
      expect(checks.filter((c) => !c.ok).map((c) => c.kind)).toEqual(['leak', 'failing-tests']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('deployLeakCheck', () => {
  const pages = (path?: string) => `jobs:\n  deploy:\n    steps:\n      - uses: actions/upload-pages-artifact@v3\n${path === undefined ? '' : `        with:\n          path: ${path}\n`}      - run: echo done\n`;

  it('passes with no host config or with a built subfolder', () => {
    expect(deployLeakCheck(undefined, {}).ok).toBe(true);
    expect(deployLeakCheck(undefined, { vercel: '{"outputDirectory":"dist"}', wrangler: 'pages_build_output_dir = "dist"', workflows: [pages('_site'), pages()] }).ok).toBe(true);
    expect(deployLeakCheck(undefined, { vercel: '', wrangler: '', workflows: [''] }).ok).toBe(true);
  });

  it('fails when Vercel, Cloudflare Pages or GitHub Pages publish the repo root', () => {
    expect(rootPublishers({ vercel: '{ "outputDirectory": "." }' })).toEqual(['vercel.json outputDirectory = "."']);
    expect(rootPublishers({ wrangler: 'name = "x"\npages_build_output_dir = "./"\n' })).toHaveLength(1);
    expect(rootPublishers({ wrangler: '[assets]\ndirectory = "."\n' })).toHaveLength(1);
    expect(rootPublishers({ workflows: [pages('.')] })).toEqual(['GitHub Pages workflow uploads "."']);
  });

  it('reports every leaking host in one failing leak check', () => {
    const check = deployLeakCheck('[build]\n publish = "."\n', { vercel: '{"outputDirectory":""}' });
    expect(check).toMatchObject({ kind: 'leak', ok: false });
    expect(check.proof).toContain('netlify');
    expect(check.proof).toContain('vercel.json');
  });

  it('checkLoop reads the config files of a clone', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'cl-leak-'));
    try {
      mkdirSync(path.join(dir, '.github', 'workflows'), { recursive: true });
      writeFileSync(path.join(dir, '.github', 'workflows', 'pages.yml'), pages('.'));
      const checks = await checkLoop(dir, { hasBlocked: false, hasDone: false, roundsDone: 0, healthFailures: [] }, now);
      expect(checks.find((c) => c.kind === 'leak')?.ok).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
