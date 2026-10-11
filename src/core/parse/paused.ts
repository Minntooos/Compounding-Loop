// `.ai/PAUSED`: one line, `who · paused <UTC ISO>[ · reason]`. Its existence stops every lane run. Pure.

export interface Paused {
  by: string;
  /** Undefined when the line carries no readable time. */
  at?: Date;
  reason?: string;
}

export const PAUSED_FILE = '.ai/PAUSED';

export function formatPaused(by: string, at: Date, reason?: string): string {
  return `${by} · paused ${at.toISOString()}${reason ? ` · ${reason}` : ''}\n`;
}

/**
 * Reads a PAUSED file. The file's existence is what pauses the loop, so a hand-written or malformed file still
 * yields a value (`by` is then its first line).
 */
export function parsePaused(text: string): Paused {
  const line = text.split(/\r?\n/).find((l) => l.trim() !== '')?.trim() ?? '';
  const match = /^(.+?)\s+·\s+paused\s+(\S+)(?:\s+·\s+(.+))?$/.exec(line);
  const at = match ? new Date(match[2] as string) : undefined;
  if (!match || !at || Number.isNaN(at.getTime())) return { by: line || 'unknown' };
  return { by: (match[1] as string).trim(), at, ...(match[3] && { reason: match[3].trim() }) };
}

/** True when the repo-relative file list contains `.ai/PAUSED`. */
export function isPaused(files: readonly string[]): boolean {
  return files.some((f) => f.replace(/\\/g, '/') === PAUSED_FILE);
}

/** One line for `loop status` and the CLI: who paused and when. */
export function describePaused(paused: Paused): string {
  return `Paused by ${paused.by}${paused.at ? ` since ${paused.at.toISOString().slice(0, 16).replace('T', ' ')} UTC` : ''}${paused.reason ? ` (${paused.reason})` : ''}`;
}
