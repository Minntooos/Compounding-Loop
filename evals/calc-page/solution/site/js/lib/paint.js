/** Litres of paint to buy: area / coverage * coats, rounded up to the next 0.5 L. */
export function litresNeeded(areaM2, coveragePerLitreM2, coats) {
  if (!Number.isFinite(areaM2) || areaM2 <= 0) throw new RangeError('area must be a positive number');
  if (!Number.isFinite(coveragePerLitreM2) || coveragePerLitreM2 <= 0) throw new RangeError('coverage must be a positive number');
  if (!Number.isInteger(coats) || coats < 1) throw new RangeError('coats must be a whole number of at least 1');
  return Math.ceil(((areaM2 / coveragePerLitreM2) * coats) * 2 - 1e-9) / 2;
}
