// Pure derivation of one lane's state from the files and commits around it.
import { LOCK_MINUTES } from './status.js';
import type { LaneState, LaneUnanswered } from './types.js';

/** A lane with neither a commit nor a lock for this long is stalled (same rule as the dashboard's health check). */
export const STALL_MINUTES = 120;

/** Rough minutes between runs of a 5-field cron expression; undefined when it cannot be read. */
export function cronPeriodMinutes(cron: string): number | undefined {
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5) return undefined;
  const [minute, hour, , , weekday] = fields as [string, string, string, string, string];
  const step = (field: string) => /^\*\/(\d+)$/.exec(field)?.[1];
  const count = (field: string) => field.split(',').length;
  const minuteStep = step(minute);
  if (minuteStep) return Number(minuteStep) || undefined;
  if (minute === '*') return 1;
  const hourStep = step(hour);
  if (hourStep) return Number(hourStep) * 60 || undefined;
  if (hour === '*') return 60;
  const perDay = 1440 / count(hour);
  return weekday === '*' ? perDay : 10_080 / count(weekday) / count(hour);
}

/** A lane is stalled after missing two scheduled runs; `STALL_MINUTES` when it has no readable cron. */
export function stallMinutesFor(cron?: string): number {
  const period = cron === undefined ? undefined : cronPeriodMinutes(cron);
  return period === undefined ? STALL_MINUTES : period * 2;
}

export interface LaneFacts {
  hasDone: boolean;
  hasBlocked: boolean;
  lockAt?: Date;
  lastCommitAt?: Date;
  /** Minutes of silence before the lane counts as stalled; defaults to STALL_MINUTES. */
  stallMinutes?: number;
}

const minutesSince = (now: Date, then: Date) => (now.getTime() - then.getTime()) / 60_000;

export function deriveLaneState(facts: LaneFacts, now: Date = new Date()): LaneState {
  if (facts.hasBlocked) return 'blocked';
  if (facts.hasDone) return 'done';
  if (facts.lockAt && minutesSince(now, facts.lockAt) < LOCK_MINUTES) return 'building';
  const latest = [facts.lockAt, facts.lastCommitAt].filter((d): d is Date => d !== undefined).map((d) => d.getTime());
  if (latest.length > 0 && minutesSince(now, new Date(Math.max(...latest))) > (facts.stallMinutes ?? STALL_MINUTES)) return 'stalled';
  return 'waiting';
}

export interface OutboxMessage {
  from: string;
  /** Lane names the message is addressed to; `all` is kept as written. */
  to: string[];
  at: string;
  text: string;
}

const OUTBOX_LINE = /^(\d{4}-\d\d-\d\d) (\d\d:\d\d) UTC · to ([^·]+?) · (.+)$/;

/** Parses `YYYY-MM-DD HH:MM UTC · to <lane|a, b|all> · message` lines; other lines are ignored. */
export function parseOutbox(from: string, text: string): OutboxMessage[] {
  const messages: OutboxMessage[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = OUTBOX_LINE.exec(line.trim());
    if (!m) continue;
    const [, date, time, to, body] = m as unknown as [string, string, string, string, string];
    messages.push({ from, to: to.split(/\s*,\s*|\s+and\s+/).map((t) => t.trim().toLowerCase()).filter(Boolean), at: `${date}T${time}:00.000Z`, text: body.trim() });
  }
  return messages;
}

export interface OutboxSummary {
  /** Per lane: messages addressed to it by name that it has not replied to since. */
  unanswered: Map<string, LaneUnanswered[]>;
  /** Per lane: lanes it is waiting on. */
  waitingOn: Map<string, string[]>;
}

/**
 * A message to a named lane counts as unanswered until that lane writes any later outbox entry.
 * A later commit by that lane (`lastCommitAt`, ISO) also counts as a reply, since a lane often answers by shipping.
 * This is a heuristic, so it only ever informs; it never fails anything.
 */
export function summarizeOutboxes(outboxes: ReadonlyMap<string, readonly OutboxMessage[]>, lastCommitAt: ReadonlyMap<string, string> = new Map()): OutboxSummary {
  const lastWrite = new Map<string, string>();
  for (const [lane, messages] of outboxes) lastWrite.set(lane, [...messages.map((m) => m.at), lastCommitAt.get(lane) ?? ''].sort().at(-1) ?? '');
  const unanswered = new Map<string, LaneUnanswered[]>();
  const waitingOn = new Map<string, string[]>();
  for (const [from, messages] of outboxes) {
    for (const message of messages) {
      for (const to of new Set(message.to)) {
        if (to === 'all' || to === from || !outboxes.has(to)) continue;
        if ((lastWrite.get(to) ?? '') >= message.at) continue;
        unanswered.set(to, [...(unanswered.get(to) ?? []), { from, to, at: message.at, text: message.text }]);
        waitingOn.set(from, [...new Set([...(waitingOn.get(from) ?? []), to])]);
      }
    }
  }
  return { unanswered, waitingOn };
}
