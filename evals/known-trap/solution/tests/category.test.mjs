import test from 'node:test';
import assert from 'node:assert/strict';
import { qtyByCategory } from '../src/stock.js';

test('qtyByCategory totals the real data file', () => {
  assert.deepEqual(qtyByCategory(new URL('../data/stock.csv', import.meta.url)), { fruit: 15, veg: 6 });
});
