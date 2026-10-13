import { PACES, PACE_SUMMARY, POLICY_FILE, formatPolicy, isPace, paceFor, parsePolicy, withPace } from '../core/parse/policy.js';
import type { Pace, Policy } from '../core/types.js';
import { syncFirst } from './pause.js';
import { checkLane, commitFiles, read, writeRel, type ScheduleOptions, type ScheduleResult } from './schedule.js';

export const readPolicy = async (dir: string): Promise<Policy> => parsePolicy((await read(dir, POLICY_FILE)) ?? '');

export interface PaceReport {
  pace: Pace;
  /** Every lane with its own entry in the file, with its pace. */
  overrides: Record<string, Pace>;
}

export async function runPaceShow(dir: string): Promise<PaceReport> {
  const policy = await readPolicy(dir);
  return { pace: policy.pace, overrides: Object.fromEntries(Object.keys(policy.lanes).map((lane) => [lane, paceFor(policy, lane)])) };
}

export function formatPaceReport(report: PaceReport): string {
  const lines = [`pace ${report.pace}: ${PACE_SUMMARY[report.pace]}`];
  for (const [lane, pace] of Object.entries(report.overrides)) lines.push(`${lane.padEnd(10)} ${pace}: ${PACE_SUMMARY[pace]}`);
  return lines.join('\n');
}

/** `loop pace set <preset> [--lane <lane>]`: writes `.ai/policy.json` and commits it with `Lane: control`. */
export async function runPaceSet(dir: string, preset: string, options: ScheduleOptions & { lane?: string } = {}): Promise<ScheduleResult> {
  if (!isPace(preset)) throw new Error(`"${preset}" is not a pace. Choose one of: ${PACES.join(', ')}.`);
  if (options.lane) await checkLane(dir, options.lane);
  if (options.commit !== false) await syncFirst(dir, options.push);
  const before = await readPolicy(dir);
  const after = withPace(before, preset, options.lane);
  const result: ScheduleResult = { changed: [], committed: false };
  if (JSON.stringify(before) === JSON.stringify(after) && (await read(dir, POLICY_FILE)) !== undefined) return result;
  result.changed.push(options.lane ?? 'all');
  await writeRel(dir, POLICY_FILE, formatPolicy(after));
  await commitFiles(dir, [POLICY_FILE], `Pace: ${options.lane ? `${options.lane} ` : ''}${preset}`, options, result);
  return result;
}
