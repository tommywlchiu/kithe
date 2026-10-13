import type { DayMovement, IsoDate, MovementSource } from '@kithe/core';
import {
  isHealthDataAvailableAsync,
  queryQuantitySamples,
  queryStatisticsForQuantity,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';

import { localDayBounds } from './localDay';

const STEPS = 'HKQuantityTypeIdentifierStepCount';
const EXERCISE = 'HKQuantityTypeIdentifierAppleExerciseTime';
const PUSHES = 'HKQuantityTypeIdentifierPushCount';
type Identifier = typeof STEPS | typeof EXERCISE | typeof PUSHES;

const USER_ENTERED = { withMetadataKey: 'HKWasUserEntered' } as const;

// cumulativeSum de-duplicates overlapping iPhone and Watch samples. The NOT filter drops
// samples typed into the Health app, so they never reach the sum.
async function sumFor(identifier: Identifier, unit: 'count' | 'min', start: Date, end: Date) {
  const date = { startDate: start, endDate: end };
  const [stats, manual] = await Promise.all([
    queryStatisticsForQuantity(identifier, ['cumulativeSum'], {
      unit,
      filter: { date, NOT: [{ metadata: USER_ENTERED }] },
    }),
    queryQuantitySamples(identifier, {
      limit: 500,
      unit,
      filter: { date, metadata: USER_ENTERED },
    }),
  ]);
  return { total: stats.sumQuantity?.quantity ?? 0, manualRecords: manual.length };
}

async function readDay(date: IsoDate): Promise<DayMovement> {
  const { start, end } = localDayBounds(date);
  const [steps, exercise, pushes] = await Promise.all([
    sumFor(STEPS, 'count', start, end),
    sumFor(EXERCISE, 'min', start, end),
    sumFor(PUSHES, 'count', start, end),
  ]);
  return {
    date,
    steps: Math.round(steps.total),
    exerciseMinutes: Math.round(exercise.total),
    wheelchairPushes: Math.round(pushes.total),
    manualRecordsExcluded: steps.manualRecords + exercise.manualRecords + pushes.manualRecords,
  };
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
    return { steps: true, exercise: true, wheelchairPushes: true };
  },

  async readDays(dates) {
    return Promise.all(dates.map(readDay));
  },
};

export const seedTestSteps: (() => Promise<number>) | null = null;
