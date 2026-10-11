import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { planNext } from '../core/next.js';
import type { NextReport } from '../core/types.js';
import { readLaneStatuses } from './laneStatus.js';

const read = (file: string) => readFile(file, 'utf8').catch(() => undefined);

/** Open units per lane for a laned repo. */
export async function runNext(dir: string, now: Date = new Date()): Promise<NextReport> {
  const statuses = await readLaneStatuses(dir, now);
  if (!statuses) throw new Error('No .ai/lanes.json here (or it is invalid). Set lanes up with `loop init --lanes a,b,c`; `loop check-lanes` explains a broken one.');
  const lanes = await Promise.all(statuses.map(async ({ name, state }) => {
    const laneDir = path.join(dir, '.ai', 'lanes', name);
    const [taskText, claimText] = await Promise.all([read(path.join(laneDir, 'task.md')), read(path.join(laneDir, 'claim'))]);
    return { name, state, ...(taskText !== undefined && { taskText }), ...(claimText !== undefined && { claimText }) };
  }));
  return planNext(lanes, now);
}
