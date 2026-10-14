/** Body mass index from kilograms and metres. Throws RangeError for impossible input. */
export function bmi(kg, metres) {
  if (!Number.isFinite(kg) || kg <= 0) throw new RangeError('weight must be a positive number');
  if (!Number.isFinite(metres) || metres <= 0) throw new RangeError('height must be a positive number');
  return kg / (metres * metres);
}
