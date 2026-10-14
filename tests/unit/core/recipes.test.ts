import { describe, expect, it } from 'vitest';
import { RECIPE_CAP_BYTES, checkRecipe, checksOf, dependencyMajors, matchRecipes, parseRecipe, recipeContext, splitRecipe, stepsOf, summarizeRecipe } from '../../../src/core/recipes.js';

const recipe = (over: Record<string, string> = {}, body?: string): string => {
  const fm = { id: 'R-calc-site', title: 'Calculator site', kind: 'project', stack: '[node@20, vite@5]', tags: '[calculator, static]', status: 'CONFIRMED', source: 'owner/repo@abc1234', uses: '2', passes: '1', updated: '2026-10-14', ...over };
  return `---\n${Object.entries(fm).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n${body ?? `# Calculator site

## When to use
A static page with a formula.

## Steps
1. Copy the starter. (proof: \`npm test\`)
2. Add the page. (proof: \`node --test\`)

## Traps
- CRLF from Python writes (K-0002).

## Checks
- \`npm test\`

## Start from
- templates/site
`}`;
};

describe('parseRecipe', () => {
  it('reads front matter, sections, steps and checks', () => {
    const r = parseRecipe(recipe());
    expect(r).toMatchObject({ id: 'R-calc-site', kind: 'project', stack: ['node@20', 'vite@5'], tags: ['calculator', 'static'], uses: 2, passes: 1, updated: '2026-10-14' });
    expect(stepsOf(r!)).toHaveLength(2);
    expect(checksOf(r!)).toHaveLength(1);
    expect(Object.keys(r!.sections)).toEqual(['When to use', 'Steps', 'Traps', 'Checks', 'Start from']);
  });
  it('is undefined without front matter, bad YAML or an id and title', () => {
    for (const t of ['# nope', '---\n: : :\n  - [\n---\n', '---\njust text\n---\n', '---\nid: R-x\n---\n']) expect(parseRecipe(t)).toBeUndefined();
    expect(splitRecipe('---\n- a\n---\n')).toBeUndefined();
  });
  it('handles CRLF files', () => expect(parseRecipe(recipe().replace(/\n/g, '\r\n'))?.id).toBe('R-calc-site'));
  it('summarises for the dashboard', () => {
    expect(summarizeRecipe(parseRecipe(recipe())!, 'user', '~/.ai/recipes/x.md')).toMatchObject({ steps: 2, checks: 1, store: 'user', path: '~/.ai/recipes/x.md' });
  });
});

describe('recipeContext', () => {
  it('drops the front matter and keeps the sections', () => {
    const c = recipeContext(recipe());
    expect(c.startsWith('# Calculator site')).toBe(true);
    expect(c).toContain('## Steps');
    expect(c).not.toContain('passes: 1');
  });
});

describe('checkRecipe', () => {
  it('passes a good recipe', () => expect(checkRecipe(recipe())).toEqual([]));
  it('explains a missing front matter', () => expect(checkRecipe('# x')[0]).toMatch(/front matter/));
  it('names missing fields, bad id, kind, status and stack', () => {
    const p = checkRecipe(recipe({ id: 'calc', kind: 'big', status: 'MAYBE', stack: '[node]' }).replace('source: owner/repo@abc1234\n', ''));
    expect(p.join('\n')).toMatch(/missing "source"/);
    expect(p.join('\n')).toMatch(/R-<slug>/);
    expect(p.join('\n')).toMatch(/kind must be/);
    expect(p.join('\n')).toMatch(/CONFIRMED or GUESS/);
    expect(p.join('\n')).toMatch(/name@major/);
  });
  it('requires sections in order', () => {
    expect(checkRecipe(recipe({}, '## Steps\n1. x `y`\n## Checks\n- `y`\n')).join('\n')).toMatch(/Missing section "## When to use"/);
    const swapped = recipe().replace('## Traps', '## Tmp').replace('## Checks', '## Traps').replace('## Tmp', '## Checks');
    expect(checkRecipe(swapped).join('\n')).toMatch(/out of order/);
  });
  it('wants a proof on every step', () => {
    expect(checkRecipe(recipe().replace(' (proof: `node --test`)', ''))).toEqual(['Step 2 names no command or test that proves it. Add the proof in backticks, e.g. "(proof: `npm test`)".']);
  });
  it('enforces the size cap', () => {
    expect(checkRecipe(recipe().replace('- templates/site', '- ' + 'x'.repeat(RECIPE_CAP_BYTES))).join()).toMatch(/cap is 6144/);
  });
  it('rejects absolute paths, emails and token-like strings but not name@major', () => {
    for (const bad of ['/home/me/x', 'C:\\Users\\me', 'me@example.com', 'ghp_' + 'a'.repeat(30), 'sk-' + 'b'.repeat(24)]) {
      expect(checkRecipe(recipe().replace('- templates/site', `- ${bad}`)).length).toBeGreaterThan(0);
    }
    expect(checkRecipe(recipe().replace('- templates/site', '- use `node@20` and ~/.ai/recipes'))).toEqual([]);
  });
});

describe('dependencyMajors', () => {
  it('reads majors from ranges and engines.node', () => {
    expect(dependencyMajors('{"engines":{"node":">=20"},"dependencies":{"a":"^4.2.1"},"devDependencies":{"b":"~1.0.0","c":"latest"}}')).toEqual({ node: '20', a: '4', b: '1' });
    expect(dependencyMajors('nope')).toEqual({});
    expect(dependencyMajors(undefined)).toEqual({});
  });
});

describe('matchRecipes', () => {
  const a = parseRecipe(recipe())!;
  const b = parseRecipe(recipe({ id: 'R-cli', title: 'CLI', stack: '[node@20, commander@12]', tags: '[cli]', passes: '5' }))!;
  const c = parseRecipe(recipe({ id: 'R-old', title: 'Old', stack: '[node@18]', tags: '[]' }))!;
  it('scores stack overlap and explains it', () => {
    const m = matchRecipes([a, b], { node: '20', vite: '5' }, '');
    expect(m.map((x) => x.recipe.id)).toEqual(['R-calc-site', 'R-cli']);
    expect(m[0]).toMatchObject({ score: 2, reason: 'stack 2/2' });
  });
  it('counts a major mismatch against and drops non-positive scores', () => {
    expect(matchRecipes([c], { node: '20' })).toEqual([]);
    expect(matchRecipes([a], { node: '18', vite: '5' })).toEqual([]);
    expect(matchRecipes([a], { node: '18', vite: '5' }, 'static calculator')[0]).toMatchObject({ score: 2, reason: 'stack 1/2, major differs: node, tags: calculator, static' });
  });
  it('adds tags found in the task text', () => {
    const m = matchRecipes([a], {}, 'Add a static calculator page');
    expect(m[0]).toMatchObject({ score: 2, reason: 'stack 0/2, tags: calculator, static' });
  });
  it('breaks ties by passes, then id', () => {
    const d = parseRecipe(recipe({ id: 'R-aaa', title: 'A', stack: '[node@20]', tags: '[]', passes: '0' }))!;
    const e = parseRecipe(recipe({ id: 'R-bbb', title: 'B', stack: '[node@20]', tags: '[]', passes: '3' }))!;
    const f = parseRecipe(recipe({ id: 'R-ccc', title: 'C', stack: '[node@20]', tags: '[]', passes: '3' }))!;
    expect(matchRecipes([d, f, e], { node: '20' }).map((x) => x.recipe.id)).toEqual(['R-bbb', 'R-ccc', 'R-aaa']);
  });
});
