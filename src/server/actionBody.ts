// Pure: turns the JSON body of a steer or schedule POST into a typed action, or says what is wrong with it (HTTP 400).
import type { LaneScheduleAction } from './data.js';

export interface SteerBody {
  lane: string;
  text: string;
  standing: boolean;
  author?: string;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';
const asRecord = (body: unknown): Record<string, unknown> => (typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {});

export function parseSteerBody(body: unknown): Parsed<SteerBody> {
  const { lane, text, standing, author } = asRecord(body);
  if (!nonEmpty(lane)) return { ok: false, error: 'lane must be a non-empty string' };
  if (!nonEmpty(text)) return { ok: false, error: 'text must be a non-empty string' };
  if (standing !== undefined && typeof standing !== 'boolean') return { ok: false, error: 'standing must be true or false' };
  return { ok: true, value: { lane, text, standing: standing === true, ...(nonEmpty(author) && { author }) } };
}

export function parseScheduleBody(body: unknown): Parsed<LaneScheduleAction> {
  const { action, lane, until, reason } = asRecord(body);
  if (!nonEmpty(lane)) return { ok: false, error: 'lane must be a non-empty string' };
  const why = nonEmpty(reason) ? { reason } : {};
  switch (action) {
    case 'pause':
      return { ok: true, value: { action, lane, ...why } };
    case 'snooze':
      if (!nonEmpty(until)) return { ok: false, error: 'until must be an ISO time, a date or a span such as 3h' };
      return { ok: true, value: { action, lane, until, ...why } };
    case 'resume':
    case 'wake':
      return { ok: true, value: { action, lane } };
    default:
      return { ok: false, error: 'action must be pause, resume, snooze or wake' };
  }
}
