import { readFileSync } from 'node:fs';

/** Number of data rows (not counting the header) in a stock CSV. */
export function rowCount(file) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/).filter((line) => line.trim() !== '');
  return Math.max(0, lines.length - 1);
}
