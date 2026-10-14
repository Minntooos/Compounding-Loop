import { describe, expect, it } from 'vitest';
import { HOOK_EVENTS, STARTER_TRIGGERS, TOOL_MATCHER, mergeHookSettings } from '../../../src/core/hooksInit.js';
import { parseTriggers } from '../../../src/core/triggers.js';

describe('mergeHookSettings', () => {
  it('creates settings with all five events, the tool matcher on tool events and a 5 s timeout', () => {
    const r = mergeHookSettings(undefined);
    expect(r.added).toEqual([...HOOK_EVENTS]);
    const hooks = (JSON.parse(r.content!) as { hooks: Record<string, { matcher?: string; hooks: { type: string; command: string; timeout: number }[] }[]> }).hooks;
    expect(hooks.PreToolUse?.[0]).toEqual({ matcher: TOOL_MATCHER, hooks: [{ type: 'command', command: 'loop hook PreToolUse', timeout: 5 }] });
    expect(hooks.SessionStart?.[0]).toEqual({ hooks: [{ type: 'command', command: 'loop hook SessionStart', timeout: 5 }] });
    expect(hooks.UserPromptSubmit?.[0]?.matcher).toBeUndefined();
  });
  it('keeps other settings and hooks, and is a no-op the second time', () => {
    const mine = JSON.stringify({ permissions: { allow: ['Bash(ls)'] }, hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo mine' }] }] } });
    const first = mergeHookSettings(mine);
    const parsed = JSON.parse(first.content!) as { permissions: unknown; hooks: { PreToolUse: unknown[] } };
    expect(parsed.permissions).toEqual({ allow: ['Bash(ls)'] });
    expect(parsed.hooks.PreToolUse).toHaveLength(2);
    const second = mergeHookSettings(first.content);
    expect(second.added).toEqual([]);
    expect(second.content).toBe(first.content);
  });
  it('recognises this repo\'s own hook command and a custom one', () => {
    expect(mergeHookSettings(mergeHookSettings(undefined, 'node bin/loop.js hook').content, 'node bin/loop.js hook').added).toEqual([]);
  });
  it('refuses unreadable settings without writing', () => {
    for (const bad of ['{nope', '[]', '{"hooks":[]}', '{"hooks":{"PreToolUse":{}}}']) {
      const r = mergeHookSettings(bad);
      expect(r.content).toBeUndefined();
      expect(r.error).toMatch(/settings\.json/);
    }
  });
  it('treats an empty file as new', () => expect(mergeHookSettings('  ').added).toHaveLength(5));
});

describe('STARTER_TRIGGERS', () => {
  it('parses with no triggers and no problems', () => expect(parseTriggers(STARTER_TRIGGERS)).toEqual({ triggers: [], problems: [] }));
});
