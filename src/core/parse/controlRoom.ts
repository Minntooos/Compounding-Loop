// The control room's notes (`.ai/control-room.md`) per lane, and which lane a commit belongs to. Pure and browser-safe.
import { parseLaneTrailer } from '../lanes.js';
import { parseOutbox, type OutboxMessage } from '../laneStatus.js';

/**
 * For each lane, the newest note addressed to it by name or to `all`. Lanes with no note are absent.
 * Ties on the minute go to the line written first, because the file is newest first.
 */
export function latestControlNotes(controlRoomMd: string, lanes: readonly string[]): Record<string, OutboxMessage> {
  const notes = parseOutbox('control', controlRoomMd);
  const result: Record<string, OutboxMessage> = {};
  for (const lane of lanes) {
    let best: OutboxMessage | undefined;
    for (const note of notes) {
      if (!note.to.includes(lane.toLowerCase()) && !note.to.includes('all')) continue;
      if (!best || note.at > best.at) best = note;
    }
    if (best) result[lane] = best;
  }
  return result;
}

/**
 * The lane a commit belongs to: its `Lane:` trailer, else a `<lane>:` subject prefix, else `release` for a
 * `Release x.y.z` subject, else `other`. Pass the lane names from `.ai/lanes.json`; `control` and `release` are always known.
 */
export function commitLane(message: string, lanes: readonly string[]): string {
  const trailer = parseLaneTrailer(message);
  if (trailer) return trailer;
  const subject = message.split(/\r?\n/, 1)[0] ?? '';
  if (/^release\s+v?\d/i.test(subject)) return 'release';
  const prefix = /^([a-z][a-z0-9-]*)(?:\s+room)?:/i.exec(subject)?.[1]?.toLowerCase();
  return prefix && [...lanes.map((l) => l.toLowerCase()), 'control', 'release'].includes(prefix) ? prefix : 'other';
}
