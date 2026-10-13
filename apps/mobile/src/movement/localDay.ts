import type { IsoDate } from '@kithe/core';

/** Device-local midnight-to-midnight bounds for a date. Home-time-zone locking arrives in T14. */
export function localDayBounds(date: IsoDate): { start: Date; end: Date } {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return { start: new Date(y, m - 1, d), end: new Date(y, m - 1, d + 1) };
}

export function todayLocal(now = new Date()): IsoDate {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
