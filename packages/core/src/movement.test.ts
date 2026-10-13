import { describe, expect, it } from 'vitest';

import { lastNDates } from './movement';

describe('lastNDates', () => {
  it('returns the window ending today, oldest first', () => {
    expect(lastNDates('2026-10-13', 3)).toEqual(['2026-10-11', '2026-10-12', '2026-10-13']);
  });

  it('crosses month and year boundaries', () => {
    expect(lastNDates('2027-01-02', 4)).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ]);
  });

  it('includes a leap day', () => {
    expect(lastNDates('2028-03-01', 2)).toEqual(['2028-02-29', '2028-03-01']);
  });

  it('returns just today for n = 1', () => {
    expect(lastNDates('2026-10-13', 1)).toEqual(['2026-10-13']);
  });

  it('rejects malformed or impossible dates and bad counts', () => {
    expect(() => lastNDates('2026-2-3', 1)).toThrow(RangeError);
    expect(() => lastNDates('2026-02-30', 1)).toThrow(RangeError);
    expect(() => lastNDates('2026-10-13', 0)).toThrow(RangeError);
    expect(() => lastNDates('2026-10-13', 1.5)).toThrow(RangeError);
  });
});
