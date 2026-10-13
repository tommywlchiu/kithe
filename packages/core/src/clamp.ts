export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || Number.isNaN(min) || Number.isNaN(max)) {
    throw new RangeError(`clamp: value must be finite and bounds must be numbers`);
  }
  if (min > max) {
    throw new RangeError(`clamp: min ${min} exceeds max ${max}`);
  }
  return Math.min(max, Math.max(min, value));
}
