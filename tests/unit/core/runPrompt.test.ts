import { describe, expect, it } from 'vitest';
import { buildClaudeArgs, buildRunPrompt, DEFAULT_PROMPT } from '../../../src/core/runPrompt.js';

describe('buildRunPrompt', () => {
  it('fills placeholders and ends with one newline', () => {
    expect(buildRunPrompt('Hello {{name}}.  \n\n', { name: 'demo' })).toBe('Hello demo.\n');
  });
  it('the default prompt keeps the stop-file and push-to-main rules', () => {
    expect(DEFAULT_PROMPT).toMatch(/DONE\.md.*BLOCKED\.md/);
    expect(DEFAULT_PROMPT).toContain('git push origin main');
  });
});

describe('buildClaudeArgs', () => {
  it('keeps the prompt as one argument and defaults to acceptEdits', () => {
    expect(buildClaudeArgs('do $(rm -rf /) "x"', { skipPermissions: false })).toEqual(['-p', 'do $(rm -rf /) "x"', '--permission-mode', 'acceptEdits', '--allowedTools', 'Bash,Edit,Write,Read,Glob,Grep,Agent,WebSearch']);
  });
  it('only skips permissions when asked, and passes a model', () => {
    expect(buildClaudeArgs('p', { skipPermissions: true, model: 'm' })).toEqual(['-p', 'p', '--model', 'm', '--dangerously-skip-permissions']);
  });
});

describe('DEFAULT_PROMPT', () => {
  it('matches the routine prompt the kit ships', async () => {
    const { readFile } = await import('node:fs/promises');
    const shipped = await readFile('runners/routine/prompt.md', 'utf8');
    expect(DEFAULT_PROMPT).toBe(shipped.trim());
  });
});
