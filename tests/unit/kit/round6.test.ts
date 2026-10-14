import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runHook } from '../../../src/cli/hook.js';
import { parseTriggers } from '../../../src/core/triggers.js';
import { HOOK_EVENTS, TOOL_MATCHER } from '../../../src/core/hooksInit.js';
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

interface HookGroup {
  matcher?: string;
  hooks: { type: string; command: string; timeout?: number }[];
}

describe('plugin/hooks/hooks.json', () => {
  const file = JSON.parse(read('plugin', 'hooks', 'hooks.json')) as { hooks: Record<string, HookGroup[]> };

  it('wires exactly the five events, each running `loop hook <event>` with a short timeout', () => {
    expect(Object.keys(file.hooks).sort()).toEqual([...HOOK_EVENTS].sort());
    for (const event of HOOK_EVENTS) {
      const [group, ...rest] = file.hooks[event] ?? [];
      expect(rest).toEqual([]);
      expect(group?.hooks).toEqual([{ type: 'command', command: `loop hook ${event}`, timeout: 5 }]);
    }
  });

  it('matches built-in tools only, on the tool events only', () => {
    for (const event of HOOK_EVENTS) {
      const matcher = file.hooks[event]?.[0]?.matcher;
      expect(matcher).toBe(['PreToolUse', 'PostToolUse', 'PostToolUseFailure'].includes(event) ? TOOL_MATCHER : undefined);
    }
  });

  it('every event runs against a sample stdin and prints nothing or the exact hookSpecificOutput shape', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'kit-hook-'));
    try {
      for (const event of HOOK_EVENTS) {
        const out = await runHook(event, JSON.stringify({ session_id: 's1', tool_name: 'Bash', tool_input: { command: 'npm test' }, prompt: 'hello', error: 'boom' }), dir);
        if (out !== '') expect(JSON.parse(out)).toEqual({ hookSpecificOutput: { hookEventName: event, additionalContext: expect.any(String) } });
      }
    } finally {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
    }
  });
});

describe('this repo\'s .claude/settings.json (dogfood)', () => {
  const settings = JSON.parse(read('.claude', 'settings.json')) as { hooks: Record<string, HookGroup[]> };
  const commandOf = (event: string): string => settings.hooks[event]?.[0]?.hooks[0]?.command ?? '';

  it('wires the five events with built-in tool matchers and a 5 s timeout', () => {
    expect(Object.keys(settings.hooks).sort()).toEqual([...HOOK_EVENTS].sort());
    for (const event of HOOK_EVENTS) {
      const group = settings.hooks[event]?.[0];
      expect(group?.hooks[0]?.timeout).toBe(5);
      expect(group?.matcher).toBe(['PreToolUse', 'PostToolUse', 'PostToolUseFailure'].includes(event) ? TOOL_MATCHER : undefined);
      expect(commandOf(event)).toContain(`hook ${event}`);
    }
  });

  it('the files its commands run exist', () => {
    for (const file of ['bin/loop.js', 'src/cli/index.ts']) {
      expect(commandOf('SessionStart')).toContain(file);
      expect(existsSync(join(root, ...file.split('/')))).toBe(true);
    }
  });

  it.skipIf(process.platform === 'win32')('runs on a sample stdin, exits 0, prints the matching entry', () => {
    const stdin = JSON.stringify({ session_id: 'kit-test', tool_name: 'Bash', error: 'EBUSY: resource busy or locked' });
    const out = execFileSync('bash', ['-c', commandOf('PostToolUseFailure')], { input: stdin, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root } });
    expect(JSON.parse(out).hookSpecificOutput.hookEventName).toBe('PostToolUseFailure');
    expect(out).toContain('maxRetries');
    rmSync(join(root, '.ai', '.trigger-log.jsonl'), { force: true });
  }, 30_000);
});

describe('.ai/triggers.yaml', () => {
  const { triggers, problems } = parseTriggers(read('.ai', 'triggers.yaml'));

  it('parses without problems and covers the traps this repo hit', () => {
    expect(problems).toEqual([]);
    const ids = triggers.map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining(['K-0001', 'K-0002', 'T-claude-exe', 'T-crlf-python', 'T-playwright-disposed', 'T-lane-ownership']));
  });

  it('every inject path points at a knowledge entry that exists', () => {
    for (const t of triggers.filter((x) => x.inject.endsWith('.md'))) expect(existsSync(join(root, ...t.inject.split('/')))).toBe(true);
  });
});
