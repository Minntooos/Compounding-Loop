import { parse } from 'yaml';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fillPlaceholders } from '../../../src/core/template.js';

const dir = join(process.cwd(), 'templates', 'lanes');
const read = (file: string): string => readFileSync(join(dir, file), 'utf8');
const templates = readdirSync(dir).filter((f) => f !== 'README.md');

const VARS = { lane: 'api', owns: 'src/api/**', lanes: 'api, web' };

/** `{{x}}` placeholders, ignoring GitHub Actions `${{ ... }}` expressions. */
const placeholdersIn = (text: string): string[] => [...text.matchAll(/(?<!\$)\{\{\s*([\w.-]+)\s*\}\}/g)].map((m) => m[1] ?? '');

describe('templates/lanes', () => {
  it('ships every file the README lists', () => {
    expect(templates.sort()).toEqual(['ci-check-lanes.yml', 'claude-section.md', 'control-room.md', 'outbox.md', 'task.md']);
  });

  it('uses only documented placeholders, and the README documents all of them', () => {
    const documented = placeholdersIn(read('README.md').split('## Placeholders')[1] ?? '');
    const documentedRows = [...(read('README.md').matchAll(/^\| `\{\{(\w+)\}\}` \|/gm))].map((m) => m[1] ?? '');
    expect(documentedRows.sort()).toEqual(Object.keys(VARS).sort());
    expect(documented.length).toBeGreaterThan(0);
    for (const file of templates) {
      for (const used of placeholdersIn(read(file))) expect(documentedRows, `${file}: {{${used}}}`).toContain(used);
    }
  });

  it('leaves no unfilled placeholder once every variable is given', () => {
    for (const file of templates) expect(placeholdersIn(fillPlaceholders(read(file), VARS)), file).toEqual([]);
  });

  it('keeps the GitHub Actions expressions in the CI snippet intact', () => {
    expect(fillPlaceholders(read('ci-check-lanes.yml'), VARS)).toContain('${{ github.sha }}');
  });

  it('lane task.md keeps the run counter and the sections the prompts rely on', () => {
    const task = read('task.md');
    expect(task).toMatch(/^Run: 0 \/ 20$/m);
    for (const heading of ['Contract', 'Units, in order', 'Decisions', 'Confirmed', 'Guesses', 'Tried', 'Don\'t', 'Handoff']) {
      expect(task).toContain(`## ${heading}`);
    }
  });

  it('CLAUDE.md section states ownership, trailer, outbox, git and stop rules', () => {
    const section = read('claude-section.md');
    for (const needle of ['Lane: <your lane>', 'loop check-lanes', 'outbox.md', 'control-room.md', 'git pull --ff-only', 'git pull --rebase', 'Never force-push', 'Lane: control', 'BLOCKED.md', 'DONE.md', '.ai/lanes.json', 'Lanes in this repo: {{lanes}}', 'reviewer subagent', 'Decisions', 'add-only', 'Never:']) {
      expect(section, needle).toContain(needle);
    }
  });

  it('CI snippet is valid YAML that fetches full history and runs check-lanes without write access', () => {
    const wf = parse(read('ci-check-lanes.yml')) as {
      permissions: Record<string, string>;
      jobs: Record<string, { steps: Array<{ with?: Record<string, unknown>; run?: string }> }>;
    };
    expect(wf.permissions).toEqual({ contents: 'read' });
    const steps = wf.jobs['check-lanes']?.steps ?? [];
    expect(steps[0]?.with).toMatchObject({ 'fetch-depth': 0, 'persist-credentials': false });
    expect(steps.some((s) => s.run?.includes('check-lanes --range'))).toBe(true);
    expect(steps.map((s) => s.run ?? '').join('\n')).toContain('git cat-file -e');
  });
});
