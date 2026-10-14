import { readdirSync } from 'node:fs';

/** The note files in a folder, sorted by name. Throws if the folder does not exist. */
export function listNotes(dir) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.txt'))
    .sort()
    .map((name) => ({ name }));
}
