// Pure (no Node imports): the live dashboard runs this in the browser.
import type { HealthCheck, LaneStatus } from '../core/types.js';

type Check = Omit<HealthCheck, 'loopId'>;

/**
 * Lane health for a laned loop. A lane with no commit or lock for more than two cron periods and no stop file
 * is stalled (core's `deriveLaneState` decides). A lane waiting on a finished lane never gets its answer:
 * the failure round 1 hit when the server lane was DONE and web kept waiting for it.
 */
export function laneChecks(lanes: readonly LaneStatus[]): Check[] {
  const done = new Set(lanes.filter((l) => l.state === 'done').map((l) => l.name));
  const stalled = lanes.filter((l) => l.state === 'stalled');
  const orphaned = lanes.flatMap((l) => (l.state === 'done' ? [] : (l.waitingOn ?? []).filter((w) => done.has(w)).map((w) => `${l.name} waits on ${w}`)));
  return [
    {
      kind: 'lane-stalled',
      ok: stalled.length === 0,
      reason: stalled.length === 0 ? 'no lane is stalled' : `stalled: ${stalled.map((l) => l.name).join(', ')} (no commit or lock for over 2 cron periods)`,
      proof: lanes.map((l) => `${l.name}=${l.state}`).join(', '),
    },
    {
      kind: 'lane-waiting-on-finished',
      ok: orphaned.length === 0,
      reason: orphaned.length === 0 ? 'no lane waits on a finished lane' : `waiting on finished lane: ${orphaned.join('; ')}`,
      proof: `done lanes: ${[...done].join(', ') || 'none'}`,
    },
  ];
}
