import { describe, expect, it } from 'vitest';

import { instantAt } from './time';

describe('instantAt', () => {
  it('places an hour on the home calendar, whatever zone the phone is in', () => {
    expect(new Date(instantAt('2026-10-20', 9, 'America/Los_Angeles')).toISOString()).toBe(
      '2026-10-20T16:00:00.000Z',
    );
    expect(new Date(instantAt('2026-10-20', 9, 'Asia/Tokyo')).toISOString()).toBe(
      '2026-10-20T00:00:00.000Z',
    );
    expect(new Date(instantAt('2026-10-20', 18, 'Asia/Kolkata')).toISOString()).toBe(
      '2026-10-20T12:30:00.000Z',
    );
  });

  it('follows daylight saving on both sides of a change', () => {
    expect(new Date(instantAt('2026-03-07', 8, 'America/New_York')).toISOString()).toBe(
      '2026-03-07T13:00:00.000Z',
    );
    expect(new Date(instantAt('2026-03-08', 8, 'America/New_York')).toISOString()).toBe(
      '2026-03-08T12:00:00.000Z',
    );
    expect(new Date(instantAt('2026-11-01', 12, 'Europe/London')).toISOString()).toBe(
      '2026-11-01T12:00:00.000Z',
    );
  });
});
