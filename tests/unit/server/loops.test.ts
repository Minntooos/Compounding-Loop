import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { InboxItem, LoopDetail, LoopSummary } from '../../../src/core/types.js';
import { createApp } from '../../../src/server/index.js';
import { bulletsUnder, contractFromTask, findLoopDirs, readLoop, readTimeline } from '../../../src/server/loops.js';

const TASK = `# Lane

Run: 3 / 30

## Contract
**Done when:**
- \`npm test\` passes
- the page loads

**Constraints:** none

## Decisions
- picked A · cheaper

## Confirmed
- thing works (a.ts:1)
`;

let root: string;
const git = (dir: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], { cwd: dir, stdio: 'ignore' });

function makeLoop(name: string, files: Record<string, string>): string {
  const dir = path.join(root, name);
  mkdirSync(path.join(dir, '.ai'), { recursive: true });
  for (const [file, text] of Object.entries(files)) writeFileSync(path.join(dir, file), text);
  git(dir, 'init', '-q');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', `first commit of ${name}`);
  return dir;
}

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), 'cl-server-'));
  makeLoop('alpha', { '.ai/task.md': TASK });
  makeLoop('beta', { '.ai/task.md': TASK, 'BLOCKED.md': '# Blocked\n\n## Question\nWhich domain?\n\n## Best guess\nUse .com\n' });
  mkdirSync(path.join(root, 'not-a-loop'));
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('parsers', () => {
  it('bulletsUnder reads bullets after a heading or bold label and stops at the next section', () => {
    expect(bulletsUnder(TASK, /^done when/i)).toEqual(['`npm test` passes', 'the page loads']);
    expect(bulletsUnder(TASK, /^decisions/i)).toEqual(['picked A · cheaper']);
    expect(bulletsUnder(TASK, /^nothing/i)).toEqual([]);
  });

  it('contractFromTask marks items passing only when finished', () => {
    expect(contractFromTask(TASK, false).map((c) => c.pass)).toEqual([false, false]);
    expect(contractFromTask(TASK, true).map((c) => c.pass)).toEqual([true, true]);
  });
});

describe('reading clones', () => {
  it('readTimeline returns commits newest first, and [] outside a repo', async () => {
    const [first] = await readTimeline(path.join(root, 'alpha'));
    expect(first?.message).toBe('first commit of alpha');
    expect(await readTimeline(path.join(root, 'not-a-loop'))).toEqual([]);
  });

  it('readLoop fills run counter, contract, decisions and a state', async () => {
    const loop = await readLoop(path.join(root, 'alpha'), new Date(Date.now() + 5 * 3_600_000));
    expect(loop).toMatchObject({ id: 'alpha', state: 'waiting', run: 3, runLimit: 30, round: 1 });
    expect(loop.contract).toHaveLength(2);
    expect(loop.knowledge).toEqual(['thing works (a.ts:1)']);
    expect(loop.decisions).toEqual(['picked A · cheaper']);
  });

  it('findLoopDirs only returns folders with .ai', async () => {
    expect((await findLoopDirs(root)).map((d) => path.basename(d))).toEqual(['alpha', 'beta']);
    expect(await findLoopDirs(path.join(root, 'missing'))).toEqual([]);
  });
});

describe('API over a projects folder', async () => {
  const app = async () => createApp({ demo: false, projectsDir: root });

  it('GET /api/loops puts the blocked loop first', async () => {
    const loops = (await (await (await app()).request('/api/loops')).json()) as LoopSummary[];
    expect(loops.map((l) => `${l.id}:${l.state}`)).toEqual(['beta:blocked', 'alpha:building']);
  });

  it('GET /api/loops/:id', async () => {
    const res = await (await app()).request('/api/loops/alpha');
    expect(((await res.json()) as LoopDetail).timeline).toHaveLength(1);
  });

  it('GET /api/inbox lists BLOCKED.md with question and best guess', async () => {
    const items = (await (await (await app()).request('/api/inbox')).json()) as InboxItem[];
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ loopId: 'beta', file: 'BLOCKED.md', question: 'Which domain?', bestGuess: 'Use .com' });
  });
});

describe('id handling', () => {
  it('never resolves an id as a path', async () => {
    const res = await (await createApp({ demo: false, projectsDir: root })).request('/api/loops/..%2Fbeta');
    expect(res.status).toBe(404);
  });
});
