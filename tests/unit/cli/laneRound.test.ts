import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runCheckLanes } from '../../../src/cli/checkLanes.js';
import { formatLaneRound, runLaneRound } from '../../../src/cli/laneRound.js';
import { addControlNote, insertBrief, nextRoundNumber, planLaneRound } from '../../../src/core/laneRound.js';

const now = new Date('2026-10-12T08:05:00Z');
const BRIEF = '## Round 5 (current): 0.5.0 "Next" — more\n\nBuild the thing.\n\n### Must have\n- `npm test` passes with 3 new tests for the thing\n';

describe('pure helpers', () => {
  it('numbers the next round from IDEA.md headings', () => {
    expect(nextRoundNumber('# IDEA\n## Round 4 (current)\n## Round 3 (finished)\n# Round 1 brief')).toBe(5);
    expect(nextRoundNumber('# IDEA\nno rounds')).toBe(1);
  });
  it('puts the brief first and marks the previous round finished', () => {
    const out = insertBrief('# IDEA: X\n\n## Round 4 (current): a\n\nold\n\n---\n\n## Round 3 (finished 2026-10-11): b\n', BRIEF, 5, now);
    expect(out.indexOf('## Round 5')).toBeLessThan(out.indexOf('## Round 4'));
    expect(out).toContain('## Round 4 (finished 2026-10-12): a');
    expect(out.startsWith('# IDEA: X\n\n## Round 5')).toBe(true);
  });
  it('adds a heading when the brief has none, and works without earlier rounds', () => {
    const out = insertBrief('# IDEA: X\n\nGoal.\n', 'Just do it.', 1, now);
    expect(out).toContain('## Round 1 (current) — started 2026-10-12 08:05 UTC\n\nJust do it.');
    expect(out).toContain('Goal.');
  });
  it('puts a control-room note above the newest one', () => {
    const out = addControlNote('# Control\n\nintro\n\n2026-10-11 10:00 UTC · to all · old\n', '2026-10-12 08:05 UTC · to all · new');
    expect(out.indexOf('· new')).toBeLessThan(out.indexOf('· old'));
    expect(addControlNote('# Control\n', 'N')).toBe('# Control\n\nN\n');
  });
  it('plans nothing against the disk: moves, resets with the old limit, and notes', () => {
    const plan = planLaneRound({
      brief: BRIEF, now, ideaText: '# IDEA\n## Round 1 (current)\n', lanes: [{ name: 'a', owns: ['src/**', 'x/**'] }, { name: 'b', owns: ['b/**'] }],
      files: ['DONE.md', '.ai/done-v1.md', '.ai/done-v3.md', '.ai/lanes/a/DONE.md', '.ai/lanes/a/done-v1.md', '.ai/lanes/b/BLOCKED.md'],
      laneTasks: { a: 'Run: 7 / 12\n', b: undefined }, taskTemplate: '# Lane: {{lane}}\n\nRun: 0 / 20\n\nOwns: {{owns}}\n', briefPath: '.ai/next-round.md',
    });
    expect(plan.round).toBe(2);
    expect(plan.blockedLanes).toEqual(['b']);
    expect(plan.changes).toContainEqual({ kind: 'move', from: 'DONE.md', to: '.ai/done-v4.md' });
    expect(plan.changes).toContainEqual({ kind: 'move', from: '.ai/lanes/a/DONE.md', to: '.ai/lanes/a/done-v2.md' });
    expect(plan.changes).toContainEqual({ kind: 'write', path: '.ai/lanes/a/task.md', content: '# Lane: a\n\nRun: 0 / 12\n\nOwns: src/**, x/**\n' });
    expect(plan.changes).toContainEqual({ kind: 'write', path: '.ai/lanes/b/task.md', content: '# Lane: b\n\nRun: 0 / 20\n\nOwns: b/**\n' });
    expect(plan.changes.at(-1)).toEqual({ kind: 'delete', path: '.ai/next-round.md' });
    expect(plan.brief.score).toBeGreaterThanOrEqual(0);
  });
});

describe('loop next-round --brief', () => {
  let dir: string;
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  const exists = (rel: string) => stat(path.join(dir, rel)).then(() => true, () => false);
  const text = (rel: string) => readFile(path.join(dir, rel), 'utf8');

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'loop-round-'));
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 't@example.com');
    git('config', 'user.name', 'Tess');
    git('config', 'commit.gpgsign', 'false');
    await mkdir(path.join(dir, '.ai', 'lanes', 'api'), { recursive: true });
    await mkdir(path.join(dir, '.ai', 'lanes', 'ui'), { recursive: true });
    await writeFile(path.join(dir, '.ai', 'lanes.json'), JSON.stringify({ lanes: [{ name: 'api', owns: ['src/api/**'] }, { name: 'ui', owns: ['src/ui/**'] }] }));
    await writeFile(path.join(dir, 'IDEA.md'), '# IDEA: T\n\n## Round 1 (current): first\n\nold brief\n');
    await writeFile(path.join(dir, 'DONE.md'), '# done\n');
    await writeFile(path.join(dir, '.ai', 'control-room.md'), '# Control room notes\n');
    await writeFile(path.join(dir, '.ai', 'lanes', 'api', 'task.md'), 'Run: 20 / 20\nold\n');
    await writeFile(path.join(dir, '.ai', 'lanes', 'api', 'DONE.md'), 'api done\n');
    await writeFile(path.join(dir, '.ai', 'next-round.md'), BRIEF);
    git('add', '-A');
    git('commit', '-qm', 'init\n\nLane: control');
  });
  afterEach(() => rm(dir, { recursive: true, force: true, maxRetries: 5 }));

  it('--dry-run lists the changes and writes nothing', async () => {
    const r = await runLaneRound(dir, { briefFile: path.join(dir, '.ai', 'next-round.md'), dryRun: true, now });
    expect(r.committed).toBe(false);
    expect(formatLaneRound(r, true)).toMatch(/^Brief score \d+\/100[^\n]*\nWould start round 2:\n[\s\S]*move +DONE\.md -> \.ai\/done-v1\.md/);
    expect(git('status', '--porcelain')).toBe('');
  });

  it('archives DONE files, resets lane tasks, notes the control room, deletes the brief and commits with Lane: control', async () => {
    const r = await runLaneRound(dir, { briefFile: path.join(dir, '.ai', 'next-round.md'), dryRun: false, now });
    expect(r.committed).toBe(true);
    expect(await exists('DONE.md')).toBe(false);
    expect(await exists('.ai/done-v1.md')).toBe(true);
    expect(await exists('.ai/lanes/api/DONE.md')).toBe(false);
    expect(await exists('.ai/lanes/api/done-v1.md')).toBe(true);
    expect(await text('.ai/lanes/api/task.md')).toMatch(/^# Lane: api[\s\S]*Run: 0 \/ 20/);
    expect(await text('.ai/lanes/ui/task.md')).toMatch(/Run: 0 \/ 20/);
    expect(await text('IDEA.md')).toMatch(/^# IDEA: T\n\n## Round 5 \(current\)/);
    expect(await text('IDEA.md')).toContain('## Round 1 (finished 2026-10-12): first');
    expect(await text('.ai/control-room.md')).toContain('Round 2 has started');
    expect(await exists('.ai/next-round.md')).toBe(false);
    expect(git('log', '-1', '--format=%B')).toContain('Lane: control');
    expect(git('status', '--porcelain')).toBe('');
    expect((await runCheckLanes(dir)).problems).toEqual([]);
  });

  it('--no-commit leaves the changes in the working tree', async () => {
    const r = await runLaneRound(dir, { briefFile: path.join(dir, '.ai', 'next-round.md'), dryRun: false, commit: false, now });
    expect(r.committed).toBe(false);
    expect(git('status', '--porcelain')).not.toBe('');
  });

  it('refuses a missing brief, a repo without lanes and a repo without IDEA.md', async () => {
    await expect(runLaneRound(dir, { briefFile: path.join(dir, 'nope.md'), dryRun: true })).rejects.toThrow(/missing or empty/);
    await rm(path.join(dir, 'IDEA.md'));
    await expect(runLaneRound(dir, { briefFile: path.join(dir, '.ai', 'next-round.md'), dryRun: true })).rejects.toThrow(/IDEA\.md/);
    await rm(path.join(dir, '.ai', 'lanes.json'));
    await expect(runLaneRound(dir, { briefFile: path.join(dir, '.ai', 'next-round.md'), dryRun: true })).rejects.toThrow(/lanes\.json/);
  });

  it('is wired into the CLI with --json and --dry-run', () => {
    const out = execFileSync(process.execPath, [path.resolve('node_modules/tsx/dist/cli.mjs'), path.resolve('src/cli/index.ts'), 'next-round', dir, '--brief', path.join(dir, '.ai', 'next-round.md'), '--dry-run', '--json'], { encoding: 'utf8' });
    const json = JSON.parse(out) as { round: number; brief: { score: number }; changes: { kind: string }[] };
    expect(json.round).toBe(2);
    expect(typeof json.brief.score).toBe('number');
    expect(json.changes.some((c) => c.kind === 'move')).toBe(true);
  });
});
