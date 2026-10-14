import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseRecipe } from '../../../src/core/recipes.js';

interface EvalSpec {
  id: string;
  task: string;
  recipe: string;
  recipeFile?: string;
  triggers?: string;
  arms: string[];
  check: string[];
  maxTurns: number;
}

const evalsDir = join(process.cwd(), 'evals');
const ids = readdirSync(evalsDir, { withFileTypes: true }).filter((e) => e.isDirectory() && existsSync(join(evalsDir, e.name, 'eval.json'))).map((e) => e.name);
const specOf = (id: string): EvalSpec => JSON.parse(readFileSync(join(evalsDir, id, 'eval.json'), 'utf8')) as EvalSpec;

/** What `loop eval` does for the fake runner: copy the fixture, optionally overlay the solution, add verify/, run the check. */
function runCheck(id: string, withSolution: boolean, work: string): number {
  const dir = join(evalsDir, id);
  cpSync(join(dir, 'repo'), work, { recursive: true });
  if (withSolution) cpSync(join(dir, 'solution'), work, { recursive: true });
  cpSync(join(dir, 'verify'), join(work, 'verify'), { recursive: true });
  const [command, ...args] = specOf(id).check;
  // Drop the parent's node:test context so the inner `node --test` runs normally.
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('NODE_TEST')));
  return spawnSync(command ?? 'node', args, { cwd: work, env, encoding: 'utf8' }).status ?? -1;
}

describe('evals/', () => {
  it('has the three starting tasks', () => {
    expect(ids).toEqual(expect.arrayContaining(['calc-page', 'cli-json', 'known-trap']));
  });

  describe.each(ids)('%s', (id) => {
    const work: string[] = [];
    const tmp = (): string => {
      const dir = mkdtempSync(join(tmpdir(), `eval-${id}-`));
      work.push(dir);
      return join(dir, 'w');
    };
    afterEach(() => {
      for (const dir of work.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
    });

    it('has the files a run needs and a zero-dependency fixture', () => {
      const spec = specOf(id);
      expect(spec.id).toBe(id);
      for (const file of [spec.task, 'verify']) expect(existsSync(join(evalsDir, id, file))).toBe(true);
      const pkg = JSON.parse(readFileSync(join(evalsDir, id, 'repo', 'package.json'), 'utf8')) as Record<string, unknown>;
      expect(pkg.dependencies).toBeUndefined();
      expect(pkg.devDependencies).toBeUndefined();
      expect(spec.arms).toContain('cold');
      expect(spec.check[0]).toBe('node');
    });

    it('names a recipe that exists and carries that id', () => {
      const spec = specOf(id);
      const file = spec.recipeFile ? join(evalsDir, id, spec.recipeFile) : join(process.cwd(), 'templates', 'recipes', `${spec.recipe.replace(/^R-/, '')}.md`);
      expect(parseRecipe(readFileSync(file, 'utf8'))?.id).toBe(spec.recipe);
    });

    it('the fixture\'s own tests pass', () => {
      const w = tmp();
      cpSync(join(evalsDir, id, 'repo'), w, { recursive: true });
      const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      expect(() => execFileSync(npm, ['test'], { cwd: w, stdio: 'pipe', shell: process.platform === 'win32' })).not.toThrow();
    });

    it('the check fails on the untouched fixture', () => {
      expect(runCheck(id, false, tmp())).not.toBe(0);
    });

    it('the check passes with the solution applied', () => {
      expect(runCheck(id, true, tmp())).toBe(0);
    });
  });
});
