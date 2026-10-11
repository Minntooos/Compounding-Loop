import { describe, expect, it } from 'vitest';
import { checkLabel, formatUtc, withLabel } from '../../../src/server/checkLabels.js';
import { staleLockCheck, runnerSilentCheck } from '../../../src/server/health.js';
import { staticApiFiles } from '../../../src/server/static-export.js';
import { snapshotSource } from '../../../src/server/data.js';
import { buildLiveLoop } from '../../../src/server/live/index.js';
import type { DemoSnapshot, HealthCheck } from '../../../src/core/types.js';

const KINDS: HealthCheck['kind'][] = ['leak', 'stale-lock', 'short-runs', 'failing-tests', 'runner-silent', 'lane-stalled', 'lane-waiting-on-finished'];
const RAW_ISO = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

describe('check labels (regression: a passing check read "OK · Tests failing")', () => {
  it('states the result for every kind, and the two results differ', () => {
    for (const kind of KINDS) {
      expect(checkLabel(kind, true)).not.toBe(checkLabel(kind, false));
    }
    expect(checkLabel('failing-tests', true)).toBe('Tests pass');
    expect(checkLabel('failing-tests', false)).toBe('Tests failing');
  });

  it('keeps a label that is already there', () => {
    expect(withLabel({ kind: 'leak', ok: false, label: 'Mine' }).label).toBe('Mine');
    expect(withLabel({ kind: 'leak', ok: false }).label).toBe('Leak found');
  });
});

describe('formatUtc', () => {
  it('formats as "11 Oct 14:53 UTC"', () => {
    expect(formatUtc('2026-10-11T14:53:20Z')).toBe('11 Oct 14:53 UTC');
    expect(formatUtc(new Date('2026-01-02T03:04:00Z'))).toBe('2 Jan 03:04 UTC');
  });
  it('returns non-dates unchanged', () => {
    expect(formatUtc('soon')).toBe('soon');
  });
});

describe('where labels and formatted times are applied', () => {
  const now = new Date('2026-10-11T12:00:00Z');
  const snapshot: DemoSnapshot = { generatedAt: '', loops: [], inbox: [], checks: [{ loopId: 'a', kind: 'failing-tests', ok: true, reason: 'all tests pass', proof: 'x' }] };

  it('health proofs carry no raw ISO time', () => {
    expect(staleLockCheck({ lockAt: new Date('2026-10-11T08:00:00Z') }, now).proof).toContain('11 Oct 08:00 UTC');
    expect(runnerSilentCheck({ hasBlocked: false, hasDone: false, lastCommitAt: new Date('2026-10-11T08:00:00Z') }, now).proof).not.toMatch(RAW_ISO);
  });

  it('the demo API and the static export label every check', async () => {
    expect((await snapshotSource(snapshot).checks())[0]?.label).toBe('Tests pass');
    expect((staticApiFiles(snapshot, '1') .get('api/checks.json') as HealthCheck[])[0]?.label).toBe('Tests pass');
  });

  it('live checks are labelled and the CI proof is formatted', () => {
    const runs = { workflow_runs: [{ name: 'CI', status: 'completed', conclusion: 'failure', updated_at: '2026-10-11T14:53:00Z' }] };
    const { checks } = buildLiveLoop({ slug: 'o/n', commits: [], runs, files: {}, now });
    expect(checks[0]).toMatchObject({ kind: 'failing-tests', ok: false, label: 'Tests failing', proof: 'CI at 11 Oct 14:53 UTC' });
  });
});
