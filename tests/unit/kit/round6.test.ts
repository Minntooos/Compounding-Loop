import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkRecipe, parseRecipe, RECIPE_CAP_BYTES } from '../../../src/core/recipes.js';

const root = process.cwd();
const read = (...parts: string[]): string => readFileSync(join(root, ...parts), 'utf8');

const objectiveOf = (text: string): string | undefined => /^\*\*Objective:\*\*.*$/m.exec(text)?.[0].trimEnd();

describe('the objective line', () => {
  const claude = objectiveOf(read('CLAUDE.md'));

  it('exists in this repo\'s Operating Card', () => {
    expect(claude).toContain('from the smallest context that still passes');
  });

  it.each([
    ['method/COMPOUNDING_LOOP.md', ['method', 'COMPOUNDING_LOOP.md']],
    ['method/operating-card.md', ['method', 'operating-card.md']],
    ['templates/static-site/CLAUDE.md', ['templates', 'static-site', 'CLAUDE.md']],
  ])('is identical in %s and CLAUDE.md', (_name, parts) => {
    expect(objectiveOf(read(...parts))).toBe(claude);
  });
});

describe('method rewrite', () => {
  const method = read('method', 'COMPOUNDING_LOOP.md');

  it('has the Experience row, the recipe layer, the hook events, the recipe step and the new measures', () => {
    expect(method).toContain('| Experience |');
    expect(method).toContain('**Recipes are the layer for procedures.**');
    for (const event of ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure']) expect(method).toContain(`\`${event}\``);
    expect(method).toContain('**Recipe step:**');
    expect(method).toContain('**Tokens per verified unit:**');
    expect(method).toContain('`loop eval`');
  });

  it('no longer calls tokens the cheapest resource', () => {
    expect(method).not.toContain('Tokens are the cheapest resource');
  });
});

describe('recipes', () => {
  const files = ['templates/recipe.md', 'templates/recipes/static-calculator-site.md', 'templates/recipes/cli-command-json.md'];

  it.each(files)('%s passes the recipe linter and stays under the cap', (file) => {
    const text = read(...file.split('/'));
    expect(checkRecipe(text)).toEqual([]);
    expect(Buffer.byteLength(text)).toBeLessThan(RECIPE_CAP_BYTES);
  });

  it('seed ids match their file names', () => {
    for (const id of ['static-calculator-site', 'cli-command-json']) {
      expect(parseRecipe(read('templates', 'recipes', `${id}.md`))?.id).toBe(`R-${id}`);
    }
  });

  it('the retro steps mention drafting a recipe', () => {
    expect(read('method', 'retro.md')).toContain('loop recipe draft');
    expect(read('plugin', 'commands', 'retro.md')).toContain('loop recipe draft');
  });
});
