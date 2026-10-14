import { describe, expect, it } from 'vitest';

import { combineSourceRecords, type DayWindow, lastNDates, type SourceRecord } from './movement';

const H = 3_600_000;
const days: DayWindow[] = [
  { date: '2026-10-12', startMs: 0, endMs: 24 * H },
  { date: '2026-10-13', startMs: 24 * H, endMs: 48 * H },
];
const rec = (over: Partial<SourceRecord>): SourceRecord => ({
  origin: 'phone',
  startMs: 10 * H,
  endMs: 11 * H,
  amount: 1000,
  manual: false,
  ...over,
});

describe('combineSourceRecords', () => {
  it('sums one app per day', () => {
    const out = combineSourceRecords([rec({}), rec({ startMs: 12 * H, endMs: 13 * H })], days);
    expect(out.map((d) => d.amount)).toEqual([2000, 0]);
  });

  it('splits a record that crosses midnight by time overlap', () => {
    const out = combineSourceRecords([rec({ startMs: 23 * H, endMs: 25 * H, amount: 600 })], days);
    expect(out.map((d) => d.amount)).toEqual([300, 300]);
  });

  it('takes the highest app instead of adding apps that logged the same walk', () => {
    const out = combineSourceRecords(
      [rec({ origin: 'phone', amount: 4000 }), rec({ origin: 'watch', amount: 4200 })],
      days,
    );
    expect(out[0]!.amount).toBe(4200);
  });

  it('never counts manual records and counts them once, on the day they start', () => {
    const out = combineSourceRecords(
      [rec({ amount: 2700 }), rec({ manual: true, startMs: 23 * H, endMs: 25 * H, amount: 5000 })],
      days,
    );
    expect(out).toEqual([
      { date: '2026-10-12', amount: 2700, manualRecords: 1 },
      { date: '2026-10-13', amount: 0, manualRecords: 0 },
    ]);
  });

  it("does not let another app's manual entry reduce real movement", () => {
    const out = combineSourceRecords(
      [
        rec({ origin: 'samsung', amount: 4000 }),
        rec({ origin: 'fit', manual: true, amount: 5000 }),
      ],
      days,
    );
    expect(out[0]!.amount).toBe(4000);
  });

  it('places zero-length records on the day they occur', () => {
    const out = combineSourceRecords([rec({ startMs: 30 * H, endMs: 30 * H, amount: 50 })], days);
    expect(out.map((d) => d.amount)).toEqual([0, 50]);
  });
});

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
