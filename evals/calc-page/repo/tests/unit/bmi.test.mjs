import test from 'node:test';
import assert from 'node:assert/strict';
import { bmi } from '../../site/js/lib/bmi.js';

test('reference cases (WHO: 70 kg at 1.75 m is 22.9)', () => {
  assert.equal(bmi(70, 1.75).toFixed(1), '22.9');
  assert.equal(bmi(50, 1.6).toFixed(1), '19.5');
});

test('rejects impossible input', () => {
  assert.throws(() => bmi(0, 1.7), RangeError);
  assert.throws(() => bmi(70, -1), RangeError);
  assert.throws(() => bmi(Number.NaN, 1.7), RangeError);
});
