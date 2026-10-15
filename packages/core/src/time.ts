import type { IsoDate } from './movement';

const formatters = new Map<string, Intl.DateTimeFormat>();

/** Whether this device's Intl data knows the zone; check before storing a home time zone. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Calendar date of an instant in a time zone, as YYYY-MM-DD. Formatters are cached per zone. */
export function localDate(ms: number, timeZone: string): IsoDate {
  let format = formatters.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    formatters.set(timeZone, format);
  }
  const parts = format.formatToParts(new Date(ms));
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

const hourFormatters = new Map<string, Intl.DateTimeFormat>();

/** Minutes the zone is ahead of UTC at an instant. */
function zoneOffsetMinutes(ms: number, timeZone: string): number {
  let format = hourFormatters.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    hourFormatters.set(timeZone, format);
  }
  const parts = format.formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return Math.round((asUtc - Math.floor(ms / 60_000) * 60_000) / 60_000);
}

/**
 * The instant a wall-clock hour happens on a date in a time zone. Kithe only asks for
 * daytime hours, which daylight-saving jumps never skip.
 */
export function instantAt(date: IsoDate, hour: number, timeZone: string): number {
  const wall = toUtc(date) + hour * 3_600_000;
  let ms = wall - zoneOffsetMinutes(wall, timeZone) * 60_000;
  ms = wall - zoneOffsetMinutes(ms, timeZone) * 60_000;
  return ms;
}

export type Clock = {
  /** The last local day already processed. */
  lastDay: IsoDate;
  homeTimeZone: string;
  /** A time zone change waits here and takes effect from the next day. */
  pendingTimeZone?: string;
};

/** Matches the design doc's 7-day sync window. */
export const MAX_CATCH_UP_DAYS = 7;

/**
 * The days that ended since the last check, oldest first, in the home time zone. At most the
 * last 7 are returned for day-by-day processing; `skippedDays` counts the older ones, which
 * still count as days together but get no events or diary. A clock moved backwards yields
 * nothing and never re-credits a day. A pending time zone change applies only after today
 * has been counted in the old zone, so travel cannot create or erase a day. A device clock
 * moved far forward still advances `lastDay`; server time replaces the device clock in
 * Phase 2.
 */
export function rolloverDay(
  clock: Clock,
  nowMs: number,
): { newDays: IsoDate[]; skippedDays: number; clock: Clock } {
  const today = localDate(nowMs, clock.homeTimeZone);
  const gap = daysBetween(clock.lastDay, today);
  if (gap <= 0) return { newDays: [], skippedDays: 0, clock };
  const processed = Math.min(gap, MAX_CATCH_UP_DAYS);
  const newDays = Array.from({ length: processed }, (_, i) => addDays(today, i - processed + 1));
  const next: Clock = { lastDay: today, homeTimeZone: clock.pendingTimeZone ?? clock.homeTimeZone };
  return { newDays, skippedDays: gap - processed, clock: next };
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
