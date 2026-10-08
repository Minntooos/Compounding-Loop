import { describe, expect, it } from 'vitest';
import { deriveLaneState, parseOutbox, summarizeOutboxes } from '../../../src/core/laneStatus.js';
import { formatLanes } from '../../../src/core/table.js';

const now = new Date('2026-10-08T12:00:00Z');
const ago = (min: number) => new Date(now.getTime() - min * 60_000);

describe('deriveLaneState', () => {
  it('ranks blocked, done, building, stalled, waiting', () => {
    expect(deriveLaneState({ hasBlocked: true, hasDone: true }, now)).toBe('blocked');
    expect(deriveLaneState({ hasBlocked: false, hasDone: true }, now)).toBe('done');
    expect(deriveLaneState({ hasBlocked: false, hasDone: false, lockAt: ago(10) }, now)).toBe('building');
    expect(deriveLaneState({ hasBlocked: false, hasDone: false, lockAt: ago(200), lastCommitAt: ago(30) }, now)).toBe('waiting');
    expect(deriveLaneState({ hasBlocked: false, hasDone: false, lockAt: ago(300), lastCommitAt: ago(240) }, now)).toBe('stalled');
    expect(deriveLaneState({ hasBlocked: false, hasDone: false }, now)).toBe('waiting');
  });
});

describe('outboxes', () => {
  const web = parseOutbox('web', 'Newest first.\n\n2026-10-08 19:55 UTC · to server · need lane data\n2026-10-08 19:55 UTC · to docs, core · screenshots ready\nnot a message');
  const server = parseOutbox('server', '2026-10-08 06:00 UTC · to web · SSE is live');
  const docs = parseOutbox('docs', '');
  const core = parseOutbox('core', '2026-10-08 20:00 UTC · to all · hello');

  it('parses lines, lists of lanes and ISO times', () => {
    expect(web).toHaveLength(2);
    expect(web[1]).toMatchObject({ from: 'web', to: ['docs', 'core'], at: '2026-10-08T19:55:00.000Z' });
  });

  it('a message is unanswered until the addressee writes something later', () => {
    const summary = summarizeOutboxes(new Map([['web', web], ['server', server], ['docs', docs], ['core', core]]));
    expect(summary.unanswered.get('server')?.map((m) => m.text)).toEqual(['need lane data']);
    expect(summary.waitingOn.get('web')).toEqual(['server', 'docs']);
    expect(summary.unanswered.get('core')).toBeUndefined(); // core replied later (20:00 > 19:55)
    expect(summary.unanswered.get('web')).toBeUndefined(); // 'all' never counts; server's note is older than web's entries
  });
});

describe('commits count as replies', () => {
  it('a later commit by the recipient answers a message', () => {
    const msg = parseOutbox('web', '2026-10-08 10:00 UTC · to server · please');
    const outboxes = new Map([['web', msg], ['server', []]]);
    expect(summarizeOutboxes(outboxes).unanswered.get('server')).toHaveLength(1);
    expect(summarizeOutboxes(outboxes, new Map([['server', '2026-10-08T11:00:00.000Z']])).unanswered.get('server')).toBeUndefined();
  });
});

describe('formatLanes', () => {
  it('prints one row per lane', () => {
    const out = formatLanes([
      { name: 'core', state: 'building', run: 3, limit: 20, locked: true, lastCommit: { sha: 'a', subject: 'core: doctor', at: ago(5).toISOString() }, unanswered: [] },
      { name: 'web', state: 'waiting', run: 0, limit: 0, locked: false, waitingOn: ['server'], unanswered: [] },
    ], now);
    expect(out.split('\n')).toHaveLength(3);
    expect(out).toMatch(/core\s+~ building\s+run 3\/20\s+5m ago: core: doctor/);
    expect(out).toMatch(/web\s+\. waiting\s+run -\s+no lane commits yet\s+waits on server/);
  });
});
