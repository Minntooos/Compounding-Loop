import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

interface Workflow {
  on: Record<string, unknown>;
  permissions: Record<string, string>;
  jobs: Record<string, { environment?: string; steps: { name?: string; run?: string; if?: string; env?: Record<string, string> }[] }>;
}

const load = (name: string): { raw: string; wf: Workflow } => {
  const raw = readFileSync(path.join(__dirname, '..', '..', '..', '.github', 'workflows', name), 'utf8');
  return { raw, wf: parse(raw) as Workflow };
};

describe('release.yml', () => {
  const { raw, wf } = load('release.yml');
  const steps = Object.values(wf.jobs).flatMap((job) => job.steps);

  it('runs only when dispatched and has a dry-run input defaulting to true', () => {
    expect(Object.keys(wf.on)).toEqual(['workflow_dispatch']);
    const inputs = (wf.on.workflow_dispatch as { inputs: Record<string, { type: string; default: boolean }> }).inputs;
    expect(inputs['dry-run']).toMatchObject({ type: 'boolean', default: true });
  });

  it('uses trusted publishing: id-token write, the release environment, no token secret', () => {
    expect(wf.permissions['id-token']).toBe('write');
    expect(wf.permissions.contents).toBe('write');
    expect(Object.values(wf.jobs).map((job) => job.environment)).toEqual(['release']);
    expect(raw.replaceAll('unset NODE_AUTH_TOKEN', '')).not.toMatch(/NODE_AUTH_TOKEN|NPM_TOKEN|secrets\.(?!GITHUB_TOKEN)/);
    expect(raw).toMatch(/npm publish --provenance --access public/);
  });

  it('checks before it publishes, and publishing steps honour the dry run', () => {
    const index = (needle: string): number => steps.findIndex((s) => s.run?.includes(needle));
    expect(index('npm test')).toBeGreaterThan(-1);
    expect(index('ship-check')).toBeGreaterThan(index('npm test'));
    expect(index('npm view')).toBeGreaterThan(-1);
    expect(index('npm publish')).toBeGreaterThan(index('ship-check'));
    for (const step of steps.filter((s) => s.run?.includes('npm publish') || s.run?.includes('gh release create'))) {
      expect(step.if).toContain('!inputs.dry-run');
    }
  });
});

describe('next-round.yml', () => {
  const { wf } = load('next-round.yml');
  const steps = Object.values(wf.jobs).flatMap((job) => job.steps);

  it('runs on pushes to main that touch .ai/next-round.md only', () => {
    expect(Object.keys(wf.on)).toEqual(['push']);
    expect(wf.on.push).toEqual({ branches: ['main'], paths: ['.ai/next-round.md'] });
    expect(wf.permissions).toEqual({ contents: 'write' });
  });

  it('runs next-round with the brief, deletes it and commits with the control lane trailer', () => {
    const run = steps.find((s) => s.run?.includes('loop.js next-round'))?.run ?? '';
    expect(run).toContain('--brief .ai/next-round.md');
    expect(run).toContain('rm -f .ai/next-round.md');
    expect(run).toContain('Lane: control');
    expect(run).toContain('git push origin HEAD:main');
  });

  it('skips every later step when the file is absent', () => {
    const later = steps.slice(steps.findIndex((s) => s.run?.includes('present=')) + 1);
    expect(later.length).toBeGreaterThan(0);
    for (const step of later) expect(step.if).toContain("present == 'true'");
  });
});
