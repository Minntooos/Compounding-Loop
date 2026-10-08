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
    expect(step?.with?.github_token).toBe('${{ secrets.GITHUB_TOKEN }}');
    expect(step?.with?.claude_args).toContain('--allowedTools');
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
    expect(xml).not.toContain('UTF-16'); // the file is saved as UTF-8
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

describe('plugin/', () => {
  it('has a valid plugin.json', () => {
    const manifest = JSON.parse(read('plugin', '.claude-plugin', 'plugin.json')) as Record<string, unknown>;
    expect(manifest.name).toBe('compounding-loop');
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(typeof manifest.description).toBe('string');
  });

  it.each(['loop-init', 'handoff', 'retro', 'stuck'])('command %s has frontmatter with a description', (name) => {
    const text = read('plugin', 'commands', `${name}.md`);
    expect(text).toMatch(/^---\ndescription: .{10,}\n---\n/);
  });
});

describe('runners/routine lane prompts', () => {
  const lane = read('runners', 'routine', 'lane-prompt.md');
  const control = read('runners', 'routine', 'control-room-prompt.md');
  const placeholders = (text: string): string[] => [...new Set([...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1] ?? ''))].sort();

  it('use only the documented placeholders', () => {
    expect(placeholders(lane)).toEqual(['lane', 'name']);
    expect(placeholders(control)).toEqual(['lanes', 'name']);
    const readme = read('runners', 'routine', 'README.md');
    for (const p of ['{{name}}', '{{lane}}', '{{lanes}}']) expect(readme).toContain(p);
  });

  it('lane prompt keeps what made the real one work', () => {
    for (const needle of ['40 minutes', 'reviewer subagent', 'git pull --ff-only', 'git pull --rebase', 'git push origin main', 'Never create or push a `claude/` branch', 'DONE.md', 'BLOCKED.md', 'Lane: {{lane}}', '.ai/control-room.md', 'outbox.md', 'Never spend money', 'force-push', 'session.lock']) {
      expect(lane, needle).toContain(needle);
    }
  });

  it('control room prompt keeps budget, stalled, leak and done handling', () => {
    for (const needle of ['run budget reached', 'stalled', 'Leak check', 'DONE.md', 'Lane: control', 'check-lanes', 'Never force-push', 'Never spend money']) {
      expect(control, needle).toContain(needle);
    }
  });

  it('carry nothing specific to the repository that built them', () => {
    for (const text of [lane, control]) expect(text).not.toMatch(/Minntooos|Compounding[_ -]Loop|trig_|gmail/i);
  });

  it('README staggers cron for 3 and 5 lanes without minute 0', () => {
    const readme = read('runners', 'routine', 'README.md');
    const rows = [...readme.matchAll(/`(\d+) (\*|\*\/\d+) \* \* \*`/g)].map((m) => Number(m[1]));
    expect(rows.length).toBeGreaterThanOrEqual(10);
    expect(rows.every((m) => m > 0 && m < 60)).toBe(true);
    expect(readme).toContain('3 lanes');
    expect(readme).toContain('5 lanes');
  });
});
