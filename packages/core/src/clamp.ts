export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`clamp: value must be finite, got ${value}`);
  }
  if (min > max) {
    throw new RangeError(`clamp: min ${min} exceeds max ${max}`);
  }
  return Math.min(max, Math.max(min, value));
}
