import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The note files in a folder, sorted by name. Throws if the folder does not exist. */
export function listNotes(dir) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.txt'))
    .sort()
    .map((name) => ({ name }));
}

/** How many notes a folder holds and how many words they contain. */
export function noteStats(dir) {
  const notes = listNotes(dir);
  const words = notes.reduce((sum, { name }) => sum + readFileSync(join(dir, name), 'utf8').split(/\s+/).filter(Boolean).length, 0);
  return { notes: notes.length, words };
}
