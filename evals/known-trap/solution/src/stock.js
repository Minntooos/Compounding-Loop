import { readFileSync } from 'node:fs';

const lines = (file) => readFileSync(file, 'utf8').split(/\r?\n/).filter((line) => line.trim() !== '');

/** Number of data rows (not counting the header) in a stock CSV. */
export function rowCount(file) {
  return Math.max(0, lines(file).length - 1);
}

/** Total qty per category, e.g. { fruit: 12, veg: 4 }. Columns are found by header name. */
export function qtyByCategory(file) {
  const [header, ...rows] = lines(file);
  const names = header.split(',').map((s) => s.trim());
  const qtyAt = names.indexOf('qty');
  const categoryAt = names.indexOf('category');
  const totals = {};
  for (const row of rows) {
    const cells = row.split(',').map((s) => s.trim());
    totals[cells[categoryAt]] = (totals[cells[categoryAt]] ?? 0) + Number(cells[qtyAt]);
  }
  return totals;
}
