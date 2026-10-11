import { parse } from 'yaml';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (...parts: string[]): string => readFileSync(join(process.cwd(), ...parts), 'utf8');

const paused = (text: string): void => {
  expect(text).toContain('.ai/PAUSED');
  expect(text).toContain('Paused');
};
const staleClone = (text: string): void => {
  expect(text).toContain('git fetch origin main');
  expect(text).toContain('FETCH_HEAD');
  expect(text).toContain('git push origin HEAD:main');
};
const runLog = (text: string): void => {
  expect(text).toContain('runs log');
  expect(text).toContain('runs.jsonl');
  expect(text).toMatch(/--no-pushed/);
};

describe('Round 4 rules: pause, run log, stale clone', () => {
  const lane = read('runners', 'routine', 'lane-prompt.md');
  const control = read('runners', 'routine', 'control-room-prompt.md');
  const section = read('templates', 'lanes', 'claude-section.md');
  const wf = read('runners', 'github-actions', 'lanes.yml');
  const loopPrompt = read('templates', 'static-site', '.ai', 'loop-prompt.md');
  const siteClaude = read('templates', 'static-site', 'CLAUDE.md');

  it('every lane-aware prompt and template honours .ai/PAUSED', () => {
    for (const text of [lane, control, section, wf, loopPrompt, siteClaude]) paused(text);
  });

  it('the lane prompt checks the pause before the stop files', () => {
    expect(lane.indexOf('.ai/PAUSED')).toBeLessThan(lane.indexOf('DONE.md'));
  });

  it('every prompt and template has the stale-clone recovery step', () => {
    for (const text of [lane, control, section, wf, loopPrompt, siteClaude]) staleClone(text);
  });

  it('never blames a force-push without checking origin/main', () => {
    expect(lane).toContain('git log origin/main');
    expect(section).toContain('git log origin/main');
  });

  it('lane prompt, lane workflow and lanes section end a run with a run-log line', () => {
    for (const text of [lane, section, wf]) runLog(text);
    expect(lane).toMatch(/pushed or not/);
    expect(lane).toContain('{{lane}}/runs.jsonl');
  });

  it('the workflow prompts parse as YAML and still carry the pause rule per job', () => {
    const doc = parse(wf) as { jobs: Record<string, { steps: Array<{ with?: { prompt?: string } }> }> };
    for (const job of ['lane', 'control']) {
      const prompt = doc.jobs[job]?.steps.find((s) => s.with?.prompt)?.with?.prompt ?? '';
      paused(prompt);
      staleClone(prompt);
    }
  });
});

describe('local runner docs', () => {
  it('explain pausing', () => {
    const text = read('runners', 'local', 'README.md');
    expect(text).toContain('loop pause');
    expect(text).toContain('.ai/PAUSED');
  });
});
