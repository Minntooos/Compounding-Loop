// `.ai/schedule.json`: which lanes a routine run should skip ("Not due"), plus the idle backoff. Pure.
import type { Schedule, ScheduleEntry, SteerEntry } from '../types.js';
import type { RunEntry } from './runs.js';
import { unacknowledged } from './steer.js';

export const SCHEDULE_FILE = '.ai/schedule.json';

const HOUR_MS = 3_600_000;

export const emptySchedule = (): Schedule => ({ version: 1, lanes: {} });

/** A lane with nothing in the file is due. */
export const dueEntry = (): ScheduleEntry => ({ notBefore: null, sleeping: false, paused: false, reason: null });

const validTime = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(new Date(v).getTime());

function toEntry(value: unknown): ScheduleEntry {
  const v = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    notBefore: validTime(v.notBefore) ? v.notBefore : null,
    sleeping: v.sleeping === true,
    paused: v.paused === true,
    reason: typeof v.reason === 'string' && v.reason.trim() ? v.reason : null,
  };
}

/** Reads a schedule file. Anything unreadable gives an empty schedule, so every lane stays due. */
export function parseSchedule(text: string): Schedule {
  try {
    const raw: unknown = JSON.parse(text);
    const lanes = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).lanes : undefined;
    if (!lanes || typeof lanes !== 'object' || Array.isArray(lanes)) return emptySchedule();
    return { version: 1, lanes: Object.fromEntries(Object.entries(lanes).map(([lane, entry]) => [lane, toEntry(entry)])) };
  } catch {
    return emptySchedule();
  }
}

export function formatSchedule(schedule: Schedule): string {
  const lanes = Object.entries(schedule.lanes).map(([lane, e]) => `    ${JSON.stringify(lane)}: ${JSON.stringify(e)}`);
  return `{\n  "version": 1,\n  "lanes": {\n${lanes.join(',\n')}${lanes.length ? '\n' : ''}  }\n}\n`;
}

export type NotDueReason = 'paused' | 'sleeping' | 'snoozed';

/** Why a run at `now` should reply "Not due"; undefined when the lane is due. A missing entry is due. */
export function notDueReason(entry: ScheduleEntry | undefined, now: Date): NotDueReason | undefined {
  if (!entry) return undefined;
  if (entry.paused) return 'paused';
  if (entry.sleeping) return 'sleeping';
  if (entry.notBefore && new Date(entry.notBefore).getTime() > now.getTime()) return 'snoozed';
  return undefined;
}

export const isDue = (entry: ScheduleEntry | undefined, now: Date): boolean => notDueReason(entry, now) === undefined;

/** Idle runs at the end of the log (a run with no units is idle; any run with units resets the count). */
export function trailingIdleRuns(runs: readonly RunEntry[]): number {
  const sorted = [...runs].sort((a, b) => a.at.localeCompare(b.at));
  let count = 0;
  for (let i = sorted.length - 1; i >= 0 && (sorted[i] as RunEntry).units.length === 0; i--) count++;
  return count;
}

/**
 * The idle backoff for one lane: 1 idle run -> not before last run + 3 h, 2 -> + 6 h, 3 or more -> sleeping.
 * No trailing idle run leaves the entry alone (an owner's snooze or pause survives). A paused entry is never changed.
 */
export function applyBackoff(runs: readonly RunEntry[], entry: ScheduleEntry | undefined, _now: Date): ScheduleEntry {
  const current = entry ?? dueEntry();
  const idle = trailingIdleRuns(runs);
  if (idle === 0 || current.paused) return current;
  if (idle >= 3) return { ...current, sleeping: true, notBefore: null, reason: `${idle} idle runs in a row` };
  const last = [...runs].sort((a, b) => a.at.localeCompare(b.at)).at(-1) as RunEntry;
  const notBefore = new Date(new Date(last.at).getTime() + (idle === 1 ? 3 : 6) * HOUR_MS).toISOString();
  return { ...current, sleeping: false, notBefore, reason: `${idle} idle run${idle === 1 ? '' : 's'} in a row` };
}

export type WakeReason = 'steer' | 'message' | 'new-round';

export interface WakeInput {
  lane: string;
  /** ISO time of the lane's newest run line; absent when it never ran. */
  lastRunAt?: string;
  steer: readonly SteerEntry[];
  /** Outbox and control-room messages; `to` lists lane names or "all". */
  messages: readonly { at: string; to: readonly string[] }[];
  /** A new round started since the lane's last run. */
  newRound?: boolean;
}

/** Why a sleeping or snoozed lane should be due again. Empty means keep sleeping. */
export function wakeReasons(input: WakeInput): WakeReason[] {
  const reasons: WakeReason[] = [];
  if (unacknowledged(input.steer).length > 0) reasons.push('steer');
  const lane = input.lane.toLowerCase();
  const since = input.lastRunAt ?? '';
  if (input.messages.some((m) => m.at > since && m.to.some((t) => t === lane || t === 'all'))) reasons.push('message');
  if (input.newRound) reasons.push('new-round');
  return reasons;
}

/** The entry after a wake: due now. A pause is a separate decision and stays. */
export const wakeEntry = (entry: ScheduleEntry | undefined): ScheduleEntry => ({ ...(entry ?? dueEntry()), sleeping: false, notBefore: null, reason: null });

/** True when the entry holds the lane back only because of the automatic backoff (not an owner's pause). */
export const isBackedOff = (entry: ScheduleEntry | undefined, now: Date): boolean => !entry?.paused && notDueReason(entry, now) !== undefined;
