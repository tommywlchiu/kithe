import type { IsoDate } from './movement';

/** Calendar date of an instant in a time zone, as YYYY-MM-DD. */
export function localDate(ms: number, timeZone: string): IsoDate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(ms));
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

const DAY_MS = 86_400_000;
const toUtc = (date: IsoDate) => Date.parse(`${date}T00:00:00Z`);

export function addDays(date: IsoDate, days: number): IsoDate {
  return new Date(toUtc(date) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

export type Clock = {
  /** The last local day already processed. */
  lastDay: IsoDate;
  homeTimeZone: string;
  /** A time zone change waits here and takes effect from the next day. */
  pendingTimeZone?: string;
};

/**
 * The days that ended since the last check, oldest first, in the home time zone. A clock
 * moved backwards yields nothing and never re-credits a day; a pending time zone change
 * applies only after today has been counted in the old zone, so travel cannot create or
 * erase a day.
 */
export function rolloverDay(clock: Clock, nowMs: number): { newDays: IsoDate[]; clock: Clock } {
  const today = localDate(nowMs, clock.homeTimeZone);
  const gap = daysBetween(clock.lastDay, today);
  if (gap <= 0) return { newDays: [], clock };
  const newDays = Array.from({ length: gap }, (_, i) => addDays(clock.lastDay, i + 1));
  const next: Clock = { lastDay: today, homeTimeZone: clock.pendingTimeZone ?? clock.homeTimeZone };
  return { newDays, clock: next };
}

/** Small deterministic PRNG (mulberry32), so events and diary picks replay from a seed. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}
