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
  requestAccess(): Promise<MovementAccess>;
  readDays(dates: readonly IsoDate[]): Promise<DayMovement[]>;
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
