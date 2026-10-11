import { describe, expect, it } from 'vitest';
import { addLanes, DEFAULT_SHARED, FALLBACK_LANE_TEMPLATES, mergeLanesSection, parseLaneList, planLanes, staggeredCron } from '../../../src/core/lanesInit.js';

describe('parseLaneList / staggeredCron', () => {
  it('splits names and rejects bad ones', () => {
    expect(parseLaneList('core, web').names).toEqual(['core', 'web']);
    expect(parseLaneList('').error).toMatch(/at least one/);
    expect(parseLaneList('Core').error).toMatch(/not a valid lane name/);
    expect(parseLaneList('control').error).toMatch(/reserved/);
    expect(parseLaneList('a,a').error).toMatch(/twice/);
  });
  it('staggers minutes', () => {
    expect([0, 1, 2, 3, 4].map(staggeredCron)).toEqual(['7 * * * *', '19 * * * *', '31 * * * *', '43 * * * *', '55 * * * *']);
  });
});

describe('addLanes', () => {
  it('starts a config with default shared files', () => {
    expect(addLanes(undefined, [{ name: 'a', owns: ['a/**'] }]).shared).toEqual(DEFAULT_SHARED);
  });
  it('stores globs slash-separated and rejects absolute or escaping ones', () => {
    expect(addLanes(undefined, [{ name: 'w', owns: ['web\\**'] }]).lanes[0]?.owns).toEqual(['web/**']);
    expect(() => addLanes(undefined, [{ name: 'w', owns: ['/abs/**'] }])).toThrow(/relative/);
    expect(() => addLanes(undefined, [{ name: 'w', owns: ['C:\\x\\**'] }])).toThrow(/relative/);
    expect(() => addLanes(undefined, [{ name: 'w', owns: ['../x/**'] }])).toThrow(/relative/);
  });
  it('rejects duplicates and overlaps with a fix', () => {
    const base = addLanes(undefined, [{ name: 'a', owns: ['src/**'] }]);
    expect(() => addLanes(base, [{ name: 'a', owns: ['x/**'] }])).toThrow(/already exists/);
    expect(() => addLanes(base, [{ name: 'b', owns: ['src/api/**'] }])).toThrow(/both own/);
  });
});

describe('mergeLanesSection', () => {
  it('appends once, replaces in place, and rejects broken markers', () => {
    const once = mergeLanesSection('# Mine\n', 'Lanes: a');
    expect(once).toContain('# Mine');
    expect(mergeLanesSection(once, 'Lanes: a')).toBe(once);
    expect(mergeLanesSection(once, 'Lanes: a, b')).toMatch(/Lanes: a, b/);
    expect(mergeLanesSection(once, 'Lanes: a, b').match(/lanes:start/g)).toHaveLength(1);
    expect(() => mergeLanesSection('<!-- compounding-loop:lanes:start -->', 'x')).toThrow(/broken/);
  });
});

describe('planLanes', () => {
  const config = addLanes(undefined, [{ name: 'api', owns: ['src/api/**'] }, { name: 'ui', owns: ['src/ui/**'] }]);
  const plan = (existing: Map<string, string>, force = false) => planLanes({ config, newLanes: ['api', 'ui'], templates: FALLBACK_LANE_TEMPLATES, existing, force });

  it('creates config, per-lane files, the control room and the CLAUDE.md section', () => {
    const dests = plan(new Map()).map((a) => a.dest);
    expect(dests).toEqual(['.ai/lanes.json', '.ai/lanes/api/task.md', '.ai/lanes/api/outbox.md', '.ai/lanes/ui/task.md', '.ai/lanes/ui/outbox.md', '.ai/control-room.md', 'CLAUDE.md']);
    const task = plan(new Map()).find((a) => a.dest === '.ai/lanes/api/task.md')!.content!;
    expect(task).toContain('# Lane: api');
    expect(task).toContain('src/api/**');
  });

  it('is idempotent', () => {
    const first = plan(new Map());
    const existing = new Map(first.map((a) => [a.dest, a.content!]));
    expect(plan(existing).every((a) => a.kind === 'skip')).toBe(true);
  });

  it('never clobbers task, outbox or control-room state, even with force', () => {
    const existing = new Map([['.ai/lanes/api/task.md', 'my progress'], ['.ai/lanes/api/outbox.md', 'my notes'], ['.ai/control-room.md', 'notes']]);
    const actions = plan(existing, true);
    for (const dest of existing.keys()) expect(actions.find((a) => a.dest === dest)).toMatchObject({ kind: 'skip' });
  });

  it('merges the lane section into an existing AGENTS.md, and only then', () => {
    expect(plan(new Map()).some((a) => a.dest === 'AGENTS.md')).toBe(false);
    const actions = plan(new Map([['AGENTS.md', '# Agents\n']]));
    const agents = actions.find((a) => a.dest === 'AGENTS.md');
    expect(agents?.kind).toBe('update');
    expect(agents?.content).toContain('# Agents');
    const again = plan(new Map([['AGENTS.md', agents!.content!]]));
    expect(again.find((a) => a.dest === 'AGENTS.md')?.kind).toBe('skip');
  });

  it('updates the config only when it changed', () => {
    const existing = new Map([['.ai/lanes.json', '{"lanes":[],"shared":[]}']]);
    expect(plan(existing).find((a) => a.dest === '.ai/lanes.json')?.kind).toBe('update');
    expect(planLanes({ config, newLanes: [], templates: FALLBACK_LANE_TEMPLATES, existing, force: false }).find((a) => a.dest === '.ai/lanes.json')?.kind).toBe('skip');
  });
});
