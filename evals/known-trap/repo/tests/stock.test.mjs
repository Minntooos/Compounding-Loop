import test from 'node:test';
import assert from 'node:assert/strict';
import { rowCount } from '../src/stock.js';

test('rowCount counts the rows of the real data file', () => {
  assert.equal(rowCount(new URL('../data/stock.csv', import.meta.url)), 5);
});
