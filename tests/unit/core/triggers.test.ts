import { describe, expect, it } from 'vitest';
import { ENTRY_CAP, INJECT_CAP, entryText, hookOutput, injectPath, matchTriggers, matches, parseTriggerLog, parseTriggers, triggerStats } from '../../../src/core/triggers.js';
import { parseRunLog } from '../../../src/core/parse/runs.js';

const YAML = `
- id: K-1
  on: error
  match: ["fetch is not a function", "/EBUSY.*unlink/i"]
  inject: .ai/knowledge/K-1.md
- id: K-2
  on: file
  match: src/background/**
  inject: "Check the service worker. (K-2)"
- id: K-3
  on: command
  match: npm run build
  inject: Run prisma generate first.
- id: K-4
  on: topic
  match: [windows, crlf]
  inject: Python writes CRLF on Windows.
`;

describe('parseTriggers', () => {
  it('reads every kind, with string or list match', () => {
    const { triggers, problems } = parseTriggers(YAML);
    expect(problems).toEqual([]);
    expect(triggers.map((t) => [t.id, t.on, t.match.length])).toEqual([['K-1', 'error', 2], ['K-2', 'file', 1], ['K-3', 'command', 1], ['K-4', 'topic', 2]]);
  });
  it('skips bad entries with a fix-it message and never throws', () => {
    const { triggers, problems } = parseTriggers('- on: error\n  match: x\n  inject: y\n- id: A\n  on: sometimes\n  match: x\n  inject: y\n- id: B\n  on: file\n  inject: y\n- id: C\n  on: file\n  match: x\n- id: D\n  on: file\n  match: x\n  inject: y\n- id: D\n  on: file\n  match: x\n  inject: y\n- 5');
    expect(triggers.map((t) => t.id)).toEqual(['D']);
    expect(problems.join('\n')).toMatch(/no "id"[\s\S]*"on" must be[\s\S]*"match" is empty[\s\S]*"inject" is empty[\s\S]*duplicate id/);
  });
  it('handles empty, non-list and invalid YAML', () => {
    expect(parseTriggers('')).toEqual({ triggers: [], problems: [] });
    expect(parseTriggers('a: 1').problems[0]).toMatch(/must be a list/);
    expect(parseTriggers('- [\n').problems[0]).toMatch(/not valid YAML/);
  });
});

describe('matches', () => {
  it('error: substring (case-insensitive) or /regex/', () => {
    expect(matches('error', 'Fetch is not', 'TypeError: fetch is not a function')).toBe(true);
    expect(matches('error', '/EBUSY.*unlink/i', 'ebusy: resource busy, unlink x')).toBe(true);
    expect(matches('error', '/(/', '(')).toBe(false);
  });
  it('file: glob on forward-slash paths', () => {
    expect(matches('file', 'src/background/**', 'src/background/a/b.ts')).toBe(true);
    expect(matches('file', 'src/background/**', 'src\\background\\a.ts')).toBe(true);
    expect(matches('file', 'src/background/**', 'web/a.ts')).toBe(false);
  });
  it('command: prefix or regex, not substring', () => {
    expect(matches('command', 'npm run build', '  npm run build -- --watch')).toBe(true);
    expect(matches('command', 'npm run build', 'cd x && npm run build')).toBe(false);
    expect(matches('command', '/&& npm run build/', 'cd x && npm run build')).toBe(true);
  });
  it('topic: keyword in the prompt', () => expect(matches('topic', 'crlf', 'Why is there CRLF here?')).toBe(true));
});

describe('matchTriggers', () => {
  const { triggers } = parseTriggers(YAML);
  const facts = (event: string, more: object) => ({ event, sessionId: 's', ...more });
  it('maps each event to its kinds', () => {
    expect(matchTriggers(triggers, facts('PostToolUseFailure', { error: 'fetch is not a function', file: 'src/background/x.ts' })).map((t) => t.id)).toEqual(['K-1', 'K-2']);
    expect(matchTriggers(triggers, facts('PostToolUse', { error: 'fetch is not a function', file: 'src/background/x.ts' })).map((t) => t.id)).toEqual(['K-2']);
    expect(matchTriggers(triggers, facts('PreToolUse', { command: 'npm run build', file: 'src/background/x.ts' })).map((t) => t.id)).toEqual(['K-3']);
    expect(matchTriggers(triggers, facts('UserPromptSubmit', { prompt: 'fix windows paths', command: 'npm run build' })).map((t) => t.id)).toEqual(['K-4']);
    expect(matchTriggers(triggers, facts('SessionStart', { prompt: 'windows' }))).toEqual([]);
    expect(matchTriggers(triggers, facts('Nope', {}))).toEqual([]);
  });
  it('skips ids already fired in the session', () => {
    expect(matchTriggers(triggers, facts('PreToolUse', { command: 'npm run build' }), new Set(['K-3']))).toEqual([]);
  });
});

describe('hookOutput and entryText', () => {
  it('has the exact hookSpecificOutput shape, or nothing', () => {
    expect(hookOutput('PreToolUse', ['  a  ', 'b'])).toEqual({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: 'a\n\nb' } });
    expect(hookOutput('PreToolUse', [])).toBeUndefined();
    expect(hookOutput('PreToolUse', ['  '])).toBeUndefined();
  });
  it('caps the whole injection at 2,000 characters', () => {
    const out = hookOutput('PostToolUse', ['x'.repeat(1500), 'y'.repeat(1500)])!;
    expect(out.hookSpecificOutput.additionalContext).toHaveLength(INJECT_CAP);
    expect(out.hookSpecificOutput.additionalContext.endsWith('…')).toBe(true);
  });
  it('drops front matter and caps an entry at 1,200 characters', () => {
    expect(entryText('---\nid: K-1\n---\n# Title\nBody')).toBe('# Title\nBody');
    expect(entryText('---\r\nid: K-1\r\n---\r\nBody')).toBe('Body');
    expect(entryText('z'.repeat(5000))).toHaveLength(ENTRY_CAP);
  });
  it('tells a path from text', () => {
    expect(injectPath('.ai/knowledge/K-1.md')).toBe('.ai/knowledge/K-1.md');
    expect(injectPath('Read the .md file')).toBeUndefined();
  });
});

describe('trigger log and stats', () => {
  const log = parseTriggerLog('{"at":"2026-10-14T01:00:00Z","session":"a","id":"K-1","event":"PostToolUseFailure"}\nbroken\n{"at":"2026-10-14T02:00:00Z","session":"b","id":"K-1","event":"PostToolUse"}\n{"at":"2026-10-14T03:00:00Z","session":"b","id":"K-9","event":"PreToolUse"}\n{"id":1}');
  it('skips broken lines', () => expect(log).toHaveLength(3));
  it('counts fires per id, includes never-fired and removed triggers', () => {
    const { triggers } = parseTriggers(YAML);
    const stats = triggerStats(triggers, log);
    expect(stats[0]).toEqual({ id: 'K-1', fired: 2, lastFired: '2026-10-14T02:00:00Z', defined: true });
    expect(stats.find((s) => s.id === 'K-9')).toMatchObject({ fired: 1, defined: false });
    expect(stats.find((s) => s.id === 'K-2')).toEqual({ id: 'K-2', fired: 0, defined: true });
  });
});

describe('run log triggers count', () => {
  it('is read when it is a whole number', () => {
    const [a, b] = parseRunLog('{"at":"2026-10-14T01:00:00Z","lane":"core","units":[],"pushed":true,"triggers":3}\n{"at":"2026-10-14T01:00:00Z","lane":"core","units":[],"pushed":true,"triggers":-1}\n');
    expect(a?.triggers).toBe(3);
    expect(b?.triggers).toBeUndefined();
  });
});
