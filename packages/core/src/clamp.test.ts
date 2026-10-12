import { describe, expect, it } from 'vitest';

import { clamp } from './clamp';

describe('clamp', () => {
  it('returns the value when it is inside the range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('raises a value below the minimum to the minimum', () => {
    expect(clamp(-1, 0, 10)).toBe(0);
  });

  it('lowers a value above the maximum to the maximum', () => {
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it('accepts a range of a single value', () => {
    expect(clamp(3, 2, 2)).toBe(2);
  });

  it('rejects non-finite values', () => {
    expect(() => clamp(Number.NaN, 0, 1)).toThrow(RangeError);
    expect(() => clamp(Number.POSITIVE_INFINITY, 0, 1)).toThrow(RangeError);
  });

  it('rejects an inverted range', () => {
    expect(() => clamp(1, 5, 0)).toThrow(RangeError);
  });
});
