import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runDraft, type ClaudeRunner } from '../../../src/cli/draft.js';
import { buildDraftPrompt, draftClaudeArgs, extractOpenFindings, extractOutOfScope, nextRoundNumber } from '../../../src/core/draftBrief.js';

describe('draft prompt pieces', () => {
  it('extractOpenFindings keeps rows whose last cell is open, drops fixed ones', () => {
    const audit = `| # | Finding | Severity | Fix |
|---|---|---|---|
| 1 | Shipped release | blocker | FIXED (run 1) |
| 2 | Phantom slots | major | open: unit 4 |
| 3 | Fixtures | minor | open |
| 4 | Odd | minor | fixed, was open |`;
    expect(extractOpenFindings('.ai/audit/x.md', audit).map((f) => f.text)).toEqual(['2 · Phantom slots · major', '3 · Fixtures · minor']);
    expect(extractOpenFindings('x', 'no table')).toEqual([]);
  });
  it('extractOutOfScope reads a heading or bold label list', () => {
    expect(extractOutOfScope('## Out of scope\n- Hosted backend\n- Analytics\n\n## Next\n- x')).toEqual(['Hosted backend', 'Analytics']);
    expect(extractOutOfScope('**Out of scope (later):**\n- Phone app\n---\n- no')).toEqual(['Phone app']);
    expect(extractOutOfScope('nothing')).toEqual([]);
  });
  it('nextRoundNumber is one above the highest round heading', () => {
    expect(nextRoundNumber('## Round 5 (current)\n## Round 4\n# Round 1 brief')).toBe(6);
    expect(nextRoundNumber('# IDEA')).toBe(2);
  });
  it('buildDraftPrompt includes every ingredient and the format the linter scores', () => {
    const prompt = buildDraftPrompt({
      name: 'demo',
      round: 6,
      next: [{ source: 'DONE.md', items: ['Fast search'] }],
      findings: [{ source: '.ai/audit/web.md', text: '2 · Phone nav · major' }],
      steer: [{ lane: 'core', entries: [{ at: '2026-10-13T10:00:00.000Z', author: 'ana', scope: 'next-run', text: 'Do the\nparser' }] }],
      outOfScope: ['Phone app'],
    });
    for (const part of ['round 6', 'Fast search', 'Phone nav', 'core (next-run, ana): Do the parser', 'Phone app', 'done when', 'Out of scope']) expect(prompt).toContain(part);
  });
  it('a draft runs read-only: no Bash, no edits', () => {
    const args = draftClaudeArgs('p', 'm');
    expect(args).toEqual(['-p', 'p', '--model', 'm', '--permission-mode', 'default', '--allowedTools', 'Read,Glob,Grep']);
  });
});

describe('loop next-round --draft', () => {
  let dir: string;
  const put = async (rel: string, text: string) => {
    await mkdir(path.dirname(path.join(dir, rel)), { recursive: true });
    await writeFile(path.join(dir, rel), text);
  };
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'loop-draft-'));
    execFileSync('git', ['init', '-q'], { cwd: dir });
    await put('IDEA.md', '## Round 2 (current)\n**Out of scope:**\n- Hosted backend\n');
    await put('.ai/lanes.json', JSON.stringify({ lanes: [{ name: 'api', owns: ['src/**'] }] }));
    await put('DONE.md', '# Done\n\n## Next 10 improvements\n1. Faster search\n2. Dark theme\n');
    await put('.ai/lanes/api/steer.md', '# s\n\n## 2026-10-13 10:00 UTC · ana · next-run\nShip the thing\n\n## 2026-10-13 09:00 UTC · ana · next-run\nOld\n→ done in run 1\n');
    await put('.ai/audit/api.md', '| # | Finding | Fix |\n|---|---|---|\n| 1 | Slow | open |\n');
  });
  afterEach(() => rm(dir, { recursive: true, force: true, maxRetries: 5 }));

  it('--print-prompt gathers every ingredient and never calls Claude', async () => {
    const claude: ClaudeRunner = () => Promise.reject(new Error('must not run'));
    const r = await runDraft(dir, { printPrompt: true, claude });
    expect(r.draft).toBeUndefined();
    expect(r.prompt).toContain('Faster search');
    expect(r.prompt).toContain('api (next-run, ana): Ship the thing');
    expect(r.prompt).not.toContain('Old');
    expect(r.prompt).toContain('.ai/audit/api.md: 1 · Slow');
    expect(r.prompt).toContain('Hosted backend');
    expect(r.prompt).toContain('round 3');
  });

  it('writes the draft where --out says and scores it', async () => {
    let seen: string[] = [];
    const claude: ClaudeRunner = async (args) => {
      seen = args;
      return '## Round 3\n\n**What we are building:** x for people who need it done well. **Audience:** solo developers.\n';
    };
    const r = await runDraft(dir, { claude, out: 'notes/draft.md', model: 'm' });
    expect(await readFile(path.join(dir, 'notes', 'draft.md'), 'utf8')).toContain('Round 3');
    expect(r.lint?.score).toBeLessThan(100);
    expect(seen).toContain('--allowedTools');
    expect(seen).toContain('m');
  });

  it('defaults to .ai/next-round.draft.md and refuses an empty answer', async () => {
    const r = await runDraft(dir, { claude: async () => '## Round 3\ntext\n' });
    expect(path.relative(dir, r.outFile as string).replace(/\\/g, '/')).toBe('.ai/next-round.draft.md');
    await expect(runDraft(dir, { claude: async () => '  \n' })).rejects.toThrow(/empty draft/);
  });
});
