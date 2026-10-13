import { parse } from 'yaml';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fillPlaceholders } from '../../../src/core/template.js';

const read = (...parts: string[]): string => readFileSync(join(process.cwd(), ...parts), 'utf8');

// What IDEA.md Round 5 B5 asks every runner and template to carry.
const notDue = (t: string): void => {
  expect(t).toContain('.ai/schedule.json');
  expect(t).toContain('Not due');
};
const steer = (t: string): void => {
  expect(t).toContain('steer.md');
  expect(t).toContain('next-run');
  expect(t).toContain('→ done in run N');
};
const runLog = (t: string): void => {
  expect(t).toContain('runs.jsonl');
  expect(t).toContain('runs log');
  expect(t).toContain('--no-pushed');
};
const staleClone = (t: string): void => {
  expect(t).toContain('git fetch origin main');
  expect(t).toContain('FETCH_HEAD');
  expect(t).toContain('git push origin HEAD:main');
};

describe('Round 5: thin prompts, schedule, steering', () => {
  const laneRun = read('templates', 'lanes', 'lane-run.md');
  const controlRun = read('templates', 'lanes', 'control-run.md');
  const lanePrompt = read('runners', 'routine', 'lane-prompt.md');
  const controlPrompt = read('runners', 'routine', 'control-room-prompt.md');
  const section = read('templates', 'lanes', 'claude-section.md');
  const wf = read('runners', 'github-actions', 'lanes.yml');

  it('the lane run procedure has the not-due skip before any install, steering, the run log and idle backoff', () => {
    notDue(laneRun);
    steer(laneRun);
    runLog(laneRun);
    expect(laneRun.indexOf('Not due')).toBeLessThan(laneRun.indexOf('Run the install'));
    expect(laneRun).toContain('notBefore');
    expect(laneRun).toContain('sleeping: true');
    expect(laneRun).toContain('+ 3 h');
    expect(laneRun).toContain('+ 6 h');
  });

  it('the lane run procedure keeps pause, stop-file and claim checks ahead of the install', () => {
    const stop = laneRun.split('2. Run the install')[0] ?? '';
    for (const needle of ['DONE.md', 'BLOCKED.md', '.ai/PAUSED', 'claim', '"Paused"', '"Nothing to do"']) expect(stop, needle).toContain(needle);
  });

  it('the control room procedure runs the schedule step before the install and wakes lanes', () => {
    expect(controlRun).toContain('.ai/schedule.json');
    expect(controlRun).toContain('`notBefore`');
    expect(controlRun.indexOf('.ai/schedule.json')).toBeLessThan(controlRun.indexOf('Run the install'));
    expect(controlRun).toContain('wake');
    expect(controlRun).toContain('Never change `paused`');
  });

  it('every thin prompt does step 0 itself and points at its procedure', () => {
    for (const text of [lanePrompt, controlPrompt]) staleClone(text);
    expect(lanePrompt).toContain('follow `.ai/lane-run.md`');
    expect(controlPrompt).toContain('follow `.ai/control-run.md`');
    expect(lanePrompt).toContain('.ai/lane-run.md` is missing');
    expect(controlPrompt).toContain('.ai/control-run.md` is missing');
  });

  it('the thin prompts keep step 0 before the procedure and name the schedule, steering and run log', () => {
    expect(lanePrompt.indexOf('git fetch origin main')).toBeLessThan(lanePrompt.indexOf('.ai/lane-run.md'));
    notDue(lanePrompt);
    expect(lanePrompt).toContain('steer.md');
    expect(lanePrompt).toContain('runs.jsonl');
  });

  it('the CLAUDE.md lanes section points at the run procedure and explains not-due and steering', () => {
    expect(section).toContain('.ai/lane-run.md');
    expect(section).toContain('.ai/control-run.md');
    notDue(section);
    expect(section).toContain('steer.md');
    expect(section).toContain('→');
  });

  it('the lanes workflow prompts point at both procedures', () => {
    const doc = parse(wf) as { jobs: Record<string, { steps: Array<{ with?: { prompt?: string } }> }> };
    const prompt = (job: string): string => doc.jobs[job]?.steps.find((s) => s.with?.prompt)?.with?.prompt ?? '';
    expect(prompt('lane')).toContain('.ai/lane-run.md');
    notDue(prompt('lane'));
    expect(prompt('lane')).toContain('steer.md');
    runLog(prompt('lane'));
    staleClone(prompt('lane'));
    expect(prompt('control')).toContain('.ai/control-run.md');
  });

  it('schedule.json is valid and starts with every lane due', () => {
    const doc = JSON.parse(read('templates', 'lanes', 'schedule.json')) as { version: number; lanes: Record<string, unknown> };
    expect(doc.version).toBe(1);
    expect(doc.lanes).toEqual({});
  });

  it('the steer template names its lane and explains the entry format', () => {
    const text = fillPlaceholders(read('templates', 'lanes', 'steer.md'), { lane: 'api' });
    expect(text).toContain('# Steering for the api lane');
    expect(text).toContain('## YYYY-MM-DD HH:MM UTC · <author> · next-run|standing');
    expect(text).toContain('→ done in run N');
  });

  it('the run procedures carry nothing specific to the repository that built them', () => {
    for (const text of [laneRun, controlRun]) {
      expect(text).not.toMatch(/Minntooos|Cockpit|node bin\/loop\.js|IDEA\.md Round|release\.yml dispatch\b.*Compounding/i);
      expect(text).not.toMatch(/\{\{/);
    }
  });
});
