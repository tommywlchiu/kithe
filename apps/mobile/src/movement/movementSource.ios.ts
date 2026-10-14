import type { DayMovement, IsoDate, MovementSource } from '@kithe/core';
import {
  isHealthDataAvailableAsync,
  queryQuantitySamples,
  queryStatisticsCollectionForQuantity,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';

import { localDayBounds, todayLocal } from './localDay';

const STEPS = 'HKQuantityTypeIdentifierStepCount';
const EXERCISE = 'HKQuantityTypeIdentifierAppleExerciseTime';
const PUSHES = 'HKQuantityTypeIdentifierPushCount';
type Identifier = typeof STEPS | typeof EXERCISE | typeof PUSHES;

const USER_ENTERED = { withMetadataKey: 'HKWasUserEntered' } as const;

type PerDay = { totals: Map<IsoDate, number>; manual: Map<IsoDate, number> };

// A daily statistics collection buckets by local midnight and splits samples that cross
// midnight across both days, matching the Health app. (A per-day statistics query counts a
// crossing sample in full on both days.) cumulativeSum also de-duplicates iPhone and Watch,
// and the NOT filter keeps samples typed into the Health app out of the sum.
async function perDay(
  identifier: Identifier,
  unit: 'count' | 'min',
  start: Date,
  end: Date,
): Promise<PerDay> {
  const date = { startDate: start, endDate: end };
  const [buckets, manualSamples] = await Promise.all([
    queryStatisticsCollectionForQuantity(
      identifier,
      ['cumulativeSum'],
      start,
      { day: 1 },
      {
        unit,
        filter: { date, NOT: [{ metadata: USER_ENTERED }] },
      },
    ),
    queryQuantitySamples(identifier, {
      limit: 0, // 0 means no limit
      unit,
      filter: { date, metadata: USER_ENTERED },
    }),
  ]);
  const totals = new Map<IsoDate, number>();
  for (const bucket of buckets) {
    if (bucket.startDate)
      totals.set(todayLocal(bucket.startDate), bucket.sumQuantity?.quantity ?? 0);
  }
  const manual = new Map<IsoDate, number>();
  for (const sample of manualSamples) {
    const day = todayLocal(sample.startDate);
    manual.set(day, (manual.get(day) ?? 0) + 1);
  }
  return { totals, manual };
}

export const movementSource: MovementSource = {
  platform: 'healthkit',

  async availability() {
    return (await isHealthDataAvailableAsync()) ? 'available' : 'unsupported';
  },

  // HealthKit never reveals whether read access was granted; a denied type just reads as 0.
  async getAccess() {
    return null;
  },

  async requestAccess() {
    await requestAuthorization({ toRead: [STEPS, EXERCISE, PUSHES] });
    return null;
  },

  async readDays(dates) {
    if (dates.length === 0) return [];
    const sorted = [...dates].sort();
    const start = localDayBounds(sorted[0]!).start;
    const end = localDayBounds(sorted[sorted.length - 1]!).end;
    const [steps, exercise, pushes] = await Promise.all([
      perDay(STEPS, 'count', start, end),
      perDay(EXERCISE, 'min', start, end),
      perDay(PUSHES, 'count', start, end),
    ]);
    return dates.map((date): DayMovement => ({
      date,
      steps: Math.round(steps.totals.get(date) ?? 0),
      exerciseMinutes: Math.round(exercise.totals.get(date) ?? 0),
      wheelchairPushes: Math.round(pushes.totals.get(date) ?? 0),
      manualRecordsExcluded:
        (steps.manual.get(date) ?? 0) +
        (exercise.manual.get(date) ?? 0) +
        (pushes.manual.get(date) ?? 0),
    }));
  },
};

export const seedTestSteps: (() => Promise<number>) | null = null;
