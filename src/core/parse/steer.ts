// `.ai/lanes/<lane>/steer.md`: notes from the owner, newest first. Pure.
import type { SteerAck, SteerEntry, SteerScope } from '../types.js';

export const steerPath = (lane: string) => `.ai/lanes/${lane}/steer.md`;

const HEADING = /^## (\d{4}-\d\d-\d\d) (\d\d:\d\d) UTC · (.+?) · (next-run|standing)\s*$/;
const ACK_DONE = /^→ done in run (\d+)\s*$/;
const ACK_NOT_DONE = /^→ not done:\s*(.*)$/;

export function steerHeading(at: Date, author: string, scope: SteerScope): string {
  return `## ${at.toISOString().slice(0, 16).replace('T', ' ')} UTC · ${author} · ${scope}`;
}

/** One entry as it is written to the file (heading, text, blank line). Newlines in the author would break the heading. */
export function formatSteerEntry(entry: { at: Date; author: string; scope: SteerScope; text: string }): string {
  const author = entry.author.replace(/[\r\n·]+/g, ' ').replace(/\s+/g, ' ').trim() || 'unknown';
  return `${steerHeading(entry.at, author, entry.scope)}\n${entry.text.trim()}\n`;
}

function parseAck(line: string): SteerAck | undefined {
  const done = ACK_DONE.exec(line);
  if (done) return { state: 'done', run: Number(done[1]) };
  const not = ACK_NOT_DONE.exec(line);
  return not ? { state: 'not-done', why: (not[1] ?? '').trim() } : undefined;
}

/** Entries in file order (newest first by convention). Text before the first heading is the file's intro and is ignored. */
export function parseSteer(text: string): SteerEntry[] {
  const entries: SteerEntry[] = [];
  let current: { head: RegExpExecArray; body: string[] } | undefined;
  const flush = () => {
    if (!current) return;
    const [, date, time, author, scope] = current.head as unknown as [string, string, string, string, SteerScope];
    const lines = current.body;
    const ackAt = lines.findIndex((l) => parseAck(l.trim()) !== undefined);
    const ack = ackAt >= 0 ? parseAck((lines[ackAt] as string).trim()) : undefined;
    const body = (ackAt >= 0 ? lines.filter((_, i) => i !== ackAt) : lines).join('\n').trim();
    entries.push({ at: `${date}T${time}:00.000Z`, author: author.trim(), scope, text: body, ...(ack && { ack }) });
  };
  for (const line of text.split(/\r?\n/)) {
    const head = HEADING.exec(line);
    if (head) {
      flush();
      current = { head, body: [] };
    } else if (/^## /.test(line)) {
      flush();
      current = undefined;
    } else current?.body.push(line);
  }
  flush();
  return entries;
}

/** Entries the lane has not read yet. A standing entry counts once, until its first acknowledgement. */
export const unacknowledged = (entries: readonly SteerEntry[]): SteerEntry[] => entries.filter((e) => !e.ack);

/** `next-run` entries first, then standing; each group newest first. This is the order a lane works in. */
export function steerOrder(entries: readonly SteerEntry[]): SteerEntry[] {
  const byTimeDesc = (a: SteerEntry, b: SteerEntry) => b.at.localeCompare(a.at);
  return [...unacknowledged(entries).filter((e) => e.scope === 'next-run').sort(byTimeDesc), ...entries.filter((e) => e.scope === 'standing').sort(byTimeDesc)];
}

/** Standing entries that still apply (acknowledged or not; they stay until removed). */
export const standingEntries = (entries: readonly SteerEntry[]): SteerEntry[] => entries.filter((e) => e.scope === 'standing');

/** Puts a new entry first (newest first), directly after the intro. An empty or missing file gets the intro-less entry alone. */
export function addSteerEntry(fileText: string, entry: { at: Date; author: string; scope: SteerScope; text: string }): string {
  const block = formatSteerEntry(entry);
  const text = fileText.replace(/\r\n/g, '\n');
  const firstEntry = text.search(/^## /m);
  if (firstEntry < 0) return `${text.trimEnd()}${text.trim() ? '\n\n' : ''}${block}`;
  return `${text.slice(0, firstEntry)}${block}\n${text.slice(firstEntry)}`;
}
