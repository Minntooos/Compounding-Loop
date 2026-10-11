// `loop next`: what is open across lanes and what to pick. Pure.
import { activeClaim } from './parse/claim.js';
import { doneUnits, parseUnits } from './parse/task.js';
import type { LaneState, NextLane, NextReport } from './types.js';

export interface NextInput {
  name: string;
  state: LaneState;
  /** Contents of the lane's task.md; undefined when it has none. */
  taskText?: string;
  /** Contents of the lane's claim file. */
  claimText?: string;
}

export function planNext(lanes: readonly NextInput[], now: Date = new Date()): NextReport {
  const rows: NextLane[] = lanes.map((lane) => {
    const claim = activeClaim(lane.claimText, now);
    const text = lane.taskText ?? '';
    const done = doneUnits(text);
    const open = lane.state === 'done' ? [] : parseUnits(text).filter((u) => !done.has(u.number));
    return { name: lane.name, state: lane.state, ...(claim && { claim: { name: claim.name, expiresAt: claim.expiresAt.toISOString() } }), openUnits: open };
  });
  const pick = rows.find((r) => !r.claim && r.state !== 'done' && r.state !== 'blocked' && r.openUnits.length > 0);
  const first = pick?.openUnits[0];
  return { lanes: rows, ...(pick && first && { recommended: { lane: pick.name, unit: first } }) };
}

export function formatNext(report: NextReport): string {
  const lines: string[] = [];
  for (const lane of report.lanes) {
    const tags = [lane.state, ...(lane.claim ? [`claimed by ${lane.claim.name} until ${lane.claim.expiresAt.slice(0, 16).replace('T', ' ')} UTC`] : [])];
    lines.push(`${lane.name} (${tags.join(', ')})`);
    if (lane.openUnits.length === 0) lines.push(lane.state === 'done' ? '  done' : '  no open units listed');
    for (const unit of lane.openUnits.slice(0, 3)) lines.push(`  ${unit.number}. ${unit.text}`);
    if (lane.openUnits.length > 3) lines.push(`  ... and ${lane.openUnits.length - 3} more`);
  }
  lines.push('');
  lines.push(report.recommended
    ? `Recommended: ${report.recommended.lane}, unit ${report.recommended.unit.number}. Take it with \`loop claim ${report.recommended.lane}\`, then \`loop run --lane ${report.recommended.lane}\`.`
    : 'Nothing to recommend: every lane is done, blocked, claimed or has no open unit.');
  return lines.join('\n');
}
