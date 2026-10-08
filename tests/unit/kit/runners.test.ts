import { parse } from 'yaml';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (...parts: string[]): string => readFileSync(join(process.cwd(), ...parts), 'utf8');

describe('runners/routine', () => {
  const prompt = read('runners', 'routine', 'prompt.md');

  it('states the shared lock, budget and DONE/BLOCKED rules', () => {
    expect(prompt).toContain('90 minutes');
    expect(prompt).toContain('Run: N / 30');
    expect(prompt).toContain('DONE.md');
    expect(prompt).toContain('BLOCKED.md');
  });

  it('pushes to main and never to a claude/ branch', () => {
    expect(prompt).toContain('git push origin main');
    expect(prompt).toMatch(/Never create or push a `claude\/` branch/);
  });

  it('uses only the documented placeholders', () => {
    const found = new Set([...prompt.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]));
    expect([...found]).toEqual(['name']);
  });

  it('documents a staggered cron and the placeholders in the README', () => {
    const readme = read('runners', 'routine', 'README.md');
    expect(readme).toContain('{{name}}');
    expect(readme).toMatch(/\d+ \* \* \* \*/);
    expect(readme).toContain('Staggered cron');
  });
});

describe('runners/github-actions/loop.yml', () => {
  const text = read('runners', 'github-actions', 'loop.yml');
  const wf = parse(text) as {
    on: { schedule: { cron: string }[] };
    permissions: Record<string, string>;
    jobs: { run: { steps: { uses?: string; with?: Record<string, string> }[] } };
  };

  it('parses and has a staggered schedule', () => {
    expect(wf.on.schedule[0]?.cron).toMatch(/^[1-9]\d? \* \* \* \*$/);
  });

  it('uses claude-code-action with secrets by reference only', () => {
    const step = wf.jobs.run.steps.find((s) => s.uses?.startsWith('anthropics/claude-code-action'));
    expect(step?.with?.anthropic_api_key).toBe('${{ secrets.ANTHROPIC_API_KEY }}');
    expect(step?.with?.claude_code_oauth_token).toBe('${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}');
    expect(text).not.toMatch(/sk-ant-|sk-[A-Za-z0-9]{20,}/);
  });

  it('grants only contents: write and states the shared numbers', () => {
    expect(wf.permissions).toEqual({ contents: 'write' });
    expect(text).toContain('90 minutes');
    expect(text).toContain('Run: N / 30');
    expect(text).toContain('DONE.md');
    expect(text).toContain('BLOCKED.md');
  });
});

describe('runners/local', () => {
  it('has a crontab line that runs `loop run`', () => {
    expect(read('runners', 'local', 'crontab.txt')).toMatch(/^\d+ \* \* \* \* cd .+ && loop run/m);
  });

  it('has a well-formed Task Scheduler XML that runs `loop run`', () => {
    const xml = read('runners', 'local', 'task-scheduler.xml');
    const parsed = new XMLValidatorLite(xml);
    expect(parsed.balanced).toBe(true);
    expect(xml).toContain('<Arguments>run</Arguments>');
    expect(xml).toContain('PT1H');
  });
});

/** Minimal tag-balance check; avoids adding an XML parser for one file. */
class XMLValidatorLite {
  readonly balanced: boolean;
  constructor(xml: string) {
    const stack: string[] = [];
    let ok = true;
    for (const [whole, closing, name] of xml.matchAll(/<(\/?)([A-Za-z][\w:.-]*)[^>]*?>/g)) {
      if (whole.endsWith('/>')) continue;
      if (closing) ok &&= stack.pop() === name;
      else stack.push(name ?? '');
    }
    this.balanced = ok && stack.length === 0;
  }
}
