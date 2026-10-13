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
  // The thin prompts only do step 0; the stop checks and run log live in the run procedures.
  const lane = read('templates', 'lanes', 'lane-run.md') + read('runners', 'routine', 'lane-prompt.md');
  const control = read('templates', 'lanes', 'control-run.md') + read('runners', 'routine', 'control-room-prompt.md');
  const section = read('templates', 'lanes', 'claude-section.md');
  const wf = read('runners', 'github-actions', 'lanes.yml');
  const loopPrompt = read('templates', 'static-site', '.ai', 'loop-prompt.md');
  const siteClaude = read('templates', 'static-site', 'CLAUDE.md');
  const routine = read('runners', 'routine', 'prompt.md');

  it('every lane-aware prompt and template honours .ai/PAUSED', () => {
    for (const text of [lane, control, section, wf, loopPrompt, siteClaude, routine]) paused(text);
  });

  it('the lane procedure checks the pause and the stop files before the install', () => {
    const laneRun = read('templates', 'lanes', 'lane-run.md');
    const install = laneRun.indexOf('Run the install');
    expect(laneRun.indexOf('.ai/PAUSED')).toBeLessThan(install);
    expect(laneRun.indexOf('DONE.md')).toBeLessThan(install);
  });

  it('every prompt and template has the stale-clone recovery step', () => {
    for (const text of [lane, control, section, wf, loopPrompt, siteClaude, routine]) staleClone(text);
  });

  it('logs the run before the final push, not after it', () => {
    const laneRun = read('templates', 'lanes', 'lane-run.md');
    expect(laneRun.indexOf('runs.jsonl')).toBeLessThan(laneRun.indexOf('Then commit, push to `main`, and stop'));
  });

  it('recovers with switch -C so a second stale run in a cached clone works', () => {
    for (const text of [lane, control, wf, section, loopPrompt, siteClaude]) {
      expect(text).toContain('switch -C');
      expect(text).not.toContain('switch -c');
    }
  });

  it('never blames a force-push without checking origin/main', () => {
    expect(lane).toContain('git log origin/main');
    expect(section).toContain('git log origin/main');
  });

  it('lane prompt, lane workflow and lanes section end a run with a run-log line', () => {
    for (const text of [lane, section, wf]) runLog(text);
    expect(lane).toMatch(/even when the run did nothing/);
    expect(lane).toContain('<lane>/runs.jsonl');
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

describe('controlling a loop', () => {
  it('the method explains pause, resume, next round and the run log', () => {
    const method = read('method', 'COMPOUNDING_LOOP.md');
    expect(method).toContain('**Controlling a loop.**');
    for (const needle of ['loop pause', 'loop resume', 'loop next-round --brief', '.ai/PAUSED', 'runs.jsonl', 'no run recorded', 'git push origin HEAD:main']) expect(method, needle).toContain(needle);
  });

  it('the /loop-pause command uses the real CLI verbs', () => {
    const text = read('plugin', 'commands', 'loop-pause.md');
    for (const needle of ['compounding-loop pause', 'compounding-loop resume', '.ai/PAUSED', 'Lane: control']) expect(text, needle).toContain(needle);
  });
});
