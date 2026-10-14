import test from 'node:test';
import assert from 'node:assert/strict';
import { litresNeeded } from '../../site/js/lib/paint.js';

test('reference cases (a tin label: 10 m2 per litre)', () => {
  assert.equal(litresNeeded(40, 10, 2), 8);
  assert.equal(litresNeeded(10, 12, 2), 2);
  assert.equal(litresNeeded(25, 10, 1), 2.5);
});

test('rejects impossible input', () => {
  assert.throws(() => litresNeeded(0, 10, 2), RangeError);
  assert.throws(() => litresNeeded(10, -1, 2), RangeError);
  assert.throws(() => litresNeeded(10, 10, 1.5), RangeError);
  assert.throws(() => litresNeeded(Number.NaN, 10, 1), RangeError);
});
