/** A calendar day in the player's local time, formatted YYYY-MM-DD. */
export type IsoDate = string;

export type DayMovement = {
  date: IsoDate;
  steps: number;
  exerciseMinutes: number;
  wheelchairPushes: number;
  /** Count of manually typed records left out of the totals (anti-cheat). */
  manualRecordsExcluded: number;
};

export type MovementAvailability = 'available' | 'not-installed' | 'needs-update' | 'unsupported';

export type MovementAccess = {
  steps: boolean;
  exercise: boolean;
  wheelchairPushes: boolean;
};

/** One per platform, implemented in the app. Raw counts never leave the device. */
export interface MovementSource {
  readonly platform: 'healthkit' | 'health-connect';
  availability(): Promise<MovementAvailability>;
  /**
   * Current grants without prompting. A revoked permission otherwise reads as a zero-movement
   * day, so the app checks this to show "reconnect" instead of "you didn't walk".
   * `null` means the platform cannot tell (HealthKit hides read grants).
   */
  getAccess(): Promise<MovementAccess | null>;
  /** Prompts for read access; resolves `null` when the platform will not say what was granted. */
  requestAccess(): Promise<MovementAccess | null>;
  /**
   * Whether `requestAccess` would show the system prompt. HealthKit asks only once; after the
   * first answer a request silently does nothing, so the app points to `openSettings` instead.
   */
  canPrompt?(): Promise<boolean>;
  /** Opens the place where the player can change access (the Health app on iOS). */
  openSettings?(): Promise<void>;
  readDays(dates: readonly IsoDate[]): Promise<DayMovement[]>;
}

/** One health record as read from a platform store, with times in epoch milliseconds. */
export type SourceRecord = {
  origin: string;
  startMs: number;
  endMs: number;
  amount: number;
  manual: boolean;
};

export type DayWindow = { date: IsoDate; startMs: number; endMs: number };

export type DayTotal = { date: IsoDate; amount: number; manualRecords: number };

/**
 * Per-day movement from raw records of one type (Android has no manual-aware aggregate).
 * Each record is split across days by time overlap, so a walk across midnight counts once.
 * Manual records never count. Each source app is summed on its own and the day takes the
 * highest app: two apps logging the same walk are not double-counted, and one app's manual
 * entry can never reduce another app's real movement.
 */
export function combineSourceRecords(
  records: readonly SourceRecord[],
  days: readonly DayWindow[],
): DayTotal[] {
  return days.map((day) => {
    const byOrigin = new Map<string, number>();
    let manualRecords = 0;
    for (const record of records) {
      const overlap = Math.min(record.endMs, day.endMs) - Math.max(record.startMs, day.startMs);
      const duration = record.endMs - record.startMs;
      const instantInDay =
        duration <= 0 && record.startMs >= day.startMs && record.startMs < day.endMs;
      if (overlap <= 0 && !instantInDay) continue;
      if (record.manual) {
        if (instantInDay || record.startMs >= day.startMs) manualRecords += 1;
        continue;
      }
      const share = duration <= 0 ? record.amount : (record.amount * overlap) / duration;
      byOrigin.set(record.origin, (byOrigin.get(record.origin) ?? 0) + share);
    }
    const amount = Math.max(0, ...byOrigin.values());
    return { date: day.date, amount, manualRecords };
  });
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The `n` dates ending at `today`, oldest first. Pure calendar math, no time zones. */
export function lastNDates(today: IsoDate, n: number): IsoDate[] {
  const match = ISO_DATE.exec(today);
  if (!match) throw new RangeError(`lastNDates: expected YYYY-MM-DD, got ${today}`);
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`lastNDates: n must be >= 1, got ${n}`);
  const [, y, m, d] = match;
  const anchor = Date.UTC(Number(y), Number(m) - 1, Number(d));
  if (new Date(anchor).toISOString().slice(0, 10) !== today) {
    throw new RangeError(`lastNDates: ${today} is not a real date`);
  }
  const dates: IsoDate[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    dates.push(new Date(anchor - i * 86_400_000).toISOString().slice(0, 10));
  }
  return dates;
}
