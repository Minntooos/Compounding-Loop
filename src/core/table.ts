import { deriveStatus } from './status.js';
import type { LaneStatus, LoopFacts } from './types.js';

export interface FleetRow {
  name: string;
  facts: LoopFacts;
  run?: { run: number; limit: number };
}

const ICON = { blocked: '!', failing: 'x', done: '+', building: '~', waiting: '.' } as const;
// Needs-you states first: blocked, failing, done, then the quiet ones.
const ORDER = ['blocked', 'failing', 'done', 'building', 'waiting'] as const;

/** Plain-text fleet table; status is always a word plus an icon, never colour alone. */
export function formatFleet(rows: readonly FleetRow[], now: Date = new Date()): string {
  const lines = rows
    .map((row) => ({ row, status: deriveStatus(row.facts, now) }))
    .sort((a, b) => ORDER.indexOf(a.status.state) - ORDER.indexOf(b.status.state) || a.row.name.localeCompare(b.row.name))
    .map(({ row, status }) => [
      row.name,
      `${ICON[status.state]} ${status.state}`,
      `round ${row.facts.roundsDone + 1}`,
      row.run ? `run ${row.run.run}/${row.run.limit}` : 'run -',
      status.reason,
    ]);
  const header = ['LOOP', 'STATUS', 'ROUND', 'RUN', 'WHY'];
  const widths = header.map((h, i) => Math.max(h.length, ...lines.map((l) => (l[i] ?? '').length)));
  const render = (cols: string[]) => cols.map((c, i) => c.padEnd(widths[i] ?? 0)).join('  ').trimEnd();
  const needs = lines.filter((l) => /blocked|failing/.test(l[1] ?? '')).length;
  const summary = needs === 0 ? 'Nothing needs you.' : `${needs} ${needs === 1 ? 'loop needs' : 'loops need'} you.`;
  return [summary, '', render(header), ...lines.map(render)].join('\n');
}

const LANE_ICON = { blocked: '!', stalled: 'x', done: '+', building: '~', waiting: '.' } as const;

/** One row per lane, for `loop status` on a laned loop. */
export function formatLanes(lanes: readonly LaneStatus[], now: Date = new Date()): string {
  const ago = (iso: string) => {
    const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000));
    return minutes < 60 ? `${minutes}m ago` : minutes < 2880 ? `${Math.round(minutes / 60)}h ago` : `${Math.round(minutes / 1440)}d ago`;
  };
  const rows = lanes.map((l) => [
    l.name,
    `${LANE_ICON[l.state]} ${l.state}`,
    l.limit > 0 ? `run ${l.run}/${l.limit}` : 'run -',
    l.lastCommit ? `${ago(l.lastCommit.at)}: ${l.lastCommit.subject.slice(0, 48)}` : 'no commits yet',
    l.waitingOn?.length ? `waits on ${l.waitingOn.join(', ')}` : l.unanswered.length ? `${l.unanswered.length} unanswered` : '',
  ]);
  const header = ['LANE', 'STATUS', 'RUN', 'LAST COMMIT', 'MESSAGES'];
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)));
  const render = (cols: string[]) => cols.map((c, i) => c.padEnd(widths[i] ?? 0)).join('  ').trimEnd();
  return [render(header), ...rows.map(render)].join('\n');
}
