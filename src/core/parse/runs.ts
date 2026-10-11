// The per-lane run log (`.ai/lanes/<lane>/runs.jsonl`) and the scheduled slots a lane's cron promises. Pure.

export interface RunEntry {
  /** ISO 8601 UTC, when the run ended. */
  at: string;
  lane: string;
  session?: string;
  units: string[];
  tests?: { passed: number; failed: number };
  pushed: boolean;
  note?: string;
}

export const runLogPath = (lane: string) => `.ai/lanes/${lane}/runs.jsonl`;

export function formatRunEntry(entry: RunEntry): string {
  return `${JSON.stringify(entry)}\n`;
}

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

function toEntry(value: unknown): RunEntry | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Record<string, unknown>;
  if (typeof v.at !== 'string' || Number.isNaN(new Date(v.at).getTime()) || typeof v.lane !== 'string' || typeof v.pushed !== 'boolean') return undefined;
  const tests = v.tests as Record<string, unknown> | undefined;
  return {
    at: v.at,
    lane: v.lane,
    ...(typeof v.session === 'string' && { session: v.session }),
    units: Array.isArray(v.units) ? v.units.filter((u): u is string => typeof u === 'string') : [],
    ...(tests && isCount(tests.passed) && isCount(tests.failed) && { tests: { passed: tests.passed, failed: tests.failed } }),
    pushed: v.pushed,
    ...(typeof v.note === 'string' && { note: v.note }),
  };
}

/** Reads a runs.jsonl; lines that are not valid entries (a half-written line, a merge marker) are skipped. Oldest first. */
export function parseRunLog(text: string): RunEntry[] {
  const entries: RunEntry[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const entry = toEntry(JSON.parse(line));
      if (entry) entries.push(entry);
    } catch {
      // skipped on purpose: see above
    }
  }
  return entries.sort((a, b) => a.at.localeCompare(b.at));
}

// ---- cron ----

const RANGES: ReadonlyArray<readonly [number, number]> = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 7]];

/** Expands one cron field (star, a number, a list, a range, or a step such as star-slash-15) into the matching numbers; undefined when unreadable. */
function expandField(field: string, [min, max]: readonly [number, number]): Set<number> | undefined {
  const out = new Set<number>();
  for (const part of field.split(',')) {
    const match = /^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/.exec(part);
    if (!match) return undefined;
    const step = match[2] === undefined ? 1 : Number(match[2]);
    if (step < 1) return undefined;
    let [from, to] = [min, max];
    if (match[1] !== '*') {
      const [a, b] = (match[1] as string).split('-');
      from = Number(a);
      to = b === undefined ? (match[2] === undefined ? from : max) : Number(b);
    }
    if (from < min || to > max || from > to) return undefined;
    for (let n = from; n <= to; n += step) out.add(n);
  }
  return out;
}

/**
 * The UTC minutes in (from, to] at which a 5-field cron expression fires. Empty for an expression this cannot read.
 * Like cron, day-of-month and day-of-week both restrict when both are set (either may match).
 */
export function expectedSlots(cron: string, from: Date, to: Date): Date[] {
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5) return [];
  const sets = fields.map((f, i) => expandField(f, RANGES[i] as readonly [number, number]));
  const [minutes, hours, days, months, weekdays] = sets;
  if (!minutes || !hours || !days || !months || !weekdays) return [];
  const dayRestricted = fields[2] !== '*';
  const weekdayRestricted = fields[4] !== '*';
  const slots: Date[] = [];
  const start = Math.floor(from.getTime() / 60_000) * 60_000 + 60_000;
  for (let t = start; t <= to.getTime() && slots.length < 10_000; t += 60_000) {
    const d = new Date(t);
    if (!minutes.has(d.getUTCMinutes()) || !hours.has(d.getUTCHours()) || !months.has(d.getUTCMonth() + 1)) continue;
    const dayOk = days.has(d.getUTCDate());
    const weekdayOk = weekdays.has(d.getUTCDay()) || (d.getUTCDay() === 0 && weekdays.has(7));
    if (dayRestricted && weekdayRestricted ? dayOk || weekdayOk : dayOk && weekdayOk) slots.push(d);
  }
  return slots;
}

export type SlotOutcome = 'pushed' | 'nothing-pushed' | 'tests-failed' | 'no-run-recorded';

export interface SlotResult {
  /** ISO 8601 UTC of the scheduled minute. */
  slot: string;
  outcome: SlotOutcome;
  entry?: RunEntry;
}

/**
 * Pairs each scheduled slot with the run that answered it. A run belongs to the latest slot at or before its end
 * time. A slot with no line but a commit before the next slot still counts as run (the agent forgot the log step)
 * and is reported as `pushed`. Anything else is "no run recorded (usage limit, idle or failed)".
 */
export function matchSlots(slots: readonly Date[], entries: readonly RunEntry[], commitTimes: readonly Date[] = []): SlotResult[] {
  const sorted = [...slots].sort((a, b) => a.getTime() - b.getTime());
  const slotFor = (time: number) => {
    let found = -1;
    for (let i = 0; i < sorted.length && (sorted[i] as Date).getTime() <= time; i++) found = i;
    return found;
  };
  const bySlot = new Map<number, RunEntry>();
  for (const entry of entries) {
    // A long run can end after the next slot starts: walk back to the latest slot nobody has claimed yet.
    for (let i = slotFor(new Date(entry.at).getTime()); i >= 0; i--) {
      if (!bySlot.has(i)) {
        bySlot.set(i, entry);
        break;
      }
    }
  }
  const committed = new Set(commitTimes.map((c) => slotFor(c.getTime())).filter((i) => i >= 0));
  return sorted.map((slot, i) => {
    const entry = bySlot.get(i);
    const iso = slot.toISOString();
    if (entry) return { slot: iso, entry, outcome: entry.tests && entry.tests.failed > 0 ? 'tests-failed' : entry.pushed ? 'pushed' : 'nothing-pushed' };
    return { slot: iso, outcome: committed.has(i) ? 'pushed' : 'no-run-recorded' };
  });
}

/** How many scheduled runs in a row, newest first, left no trace. The dashboard raises an attention item at 3. */
export function missedInARow(results: readonly SlotResult[]): number {
  let count = 0;
  for (let i = results.length - 1; i >= 0 && results[i]?.outcome === 'no-run-recorded'; i--) count++;
  return count;
}
