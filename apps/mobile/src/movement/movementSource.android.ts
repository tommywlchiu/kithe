import type { DayMovement, IsoDate, MovementAccess, MovementSource } from '@kithe/core';
import {
  aggregateRecord,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  insertRecords,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';

import { localDayBounds } from './localDay';

const MANUAL_ENTRY = 3; // RecordingMethod.RECORDING_METHOD_MANUAL_ENTRY

const READS = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'ExerciseSession' },
  { accessType: 'read', recordType: 'WheelchairPushes' },
] as const;

let initialized: Promise<boolean> | null = null;
const ensureInitialized = () => (initialized ??= initialize());

function toAccess(granted: readonly { accessType: string; recordType?: string }[]): MovementAccess {
  const has = (recordType: string) =>
    granted.some((p) => p.accessType === 'read' && p.recordType === recordType);
  return {
    steps: has('Steps'),
    exercise: has('ExerciseSession'),
    wheelchairPushes: has('WheelchairPushes'),
  };
}

type Manual = { count: number; records: number; seconds: number };

// Aggregation already applies Health Connect's per-app priority de-duplication, but it
// cannot filter by recording method, so manual entries are read separately and subtracted.
async function manualEntries(
  recordType: 'Steps' | 'WheelchairPushes' | 'ExerciseSession',
  start: Date,
  end: Date,
): Promise<Manual> {
  const totals: Manual = { count: 0, records: 0, seconds: 0 };
  let pageToken: string | undefined;
  do {
    const page = await readRecords(recordType, {
      timeRangeFilter: {
        operator: 'between',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      },
      pageToken,
    });
    for (const record of page.records) {
      if (record.metadata?.recordingMethod !== MANUAL_ENTRY) continue;
      totals.records += 1;
      if ('count' in record && typeof record.count === 'number') totals.count += record.count;
      totals.seconds +=
        (new Date(record.endTime).getTime() - new Date(record.startTime).getTime()) / 1000;
    }
    pageToken = page.pageToken || undefined;
  } while (pageToken);
  return totals;
}

async function readDay(date: IsoDate, access: MovementAccess): Promise<DayMovement> {
  const { start, end } = localDayBounds(date);
  const timeRangeFilter = {
    operator: 'between' as const,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  };
  let steps = 0;
  let exerciseMinutes = 0;
  let wheelchairPushes = 0;
  let manualRecordsExcluded = 0;

  if (access.steps) {
    const [total, manual] = await Promise.all([
      aggregateRecord({ recordType: 'Steps', timeRangeFilter }),
      manualEntries('Steps', start, end),
    ]);
    steps = Math.max(0, total.COUNT_TOTAL - manual.count);
    manualRecordsExcluded += manual.records;
  }
  if (access.exercise) {
    const [total, manual] = await Promise.all([
      aggregateRecord({ recordType: 'ExerciseSession', timeRangeFilter }),
      manualEntries('ExerciseSession', start, end),
    ]);
    exerciseMinutes = Math.max(
      0,
      Math.round((total.EXERCISE_DURATION_TOTAL.inSeconds - manual.seconds) / 60),
    );
    manualRecordsExcluded += manual.records;
  }
  if (access.wheelchairPushes) {
    const [total, manual] = await Promise.all([
      aggregateRecord({ recordType: 'WheelchairPushes', timeRangeFilter }),
      manualEntries('WheelchairPushes', start, end),
    ]);
    wheelchairPushes = Math.max(0, total.COUNT_TOTAL - manual.count);
    manualRecordsExcluded += manual.records;
  }
  return { date, steps, exerciseMinutes, wheelchairPushes, manualRecordsExcluded };
}

export const movementSource: MovementSource = {
  platform: 'health-connect',

  async availability() {
    const status = await getSdkStatus();
    if (status === SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
      return 'needs-update';
    }
    return 'not-installed';
  },

  async getAccess() {
    await ensureInitialized();
    return toAccess(await getGrantedPermissions());
  },

  async requestAccess() {
    await ensureInitialized();
    return toAccess(await requestPermission([...READS]));
  },

  async readDays(dates) {
    await ensureInitialized();
    const access = toAccess(await getGrantedPermissions());
    return Promise.all(dates.map((date) => readDay(date, access)));
  },
};

/** Writes 4 sample step records for today, one marked as typed in by hand. Dev builds only. */
export const seedTestSteps: (() => Promise<number>) | null = async () => {
  await ensureInitialized();
  await requestPermission([{ accessType: 'write', recordType: 'Steps' }]);
  const now = Date.now();
  const hour = 3_600_000;
  const record = (hoursAgo: number, count: number, recordingMethod: number) => ({
    recordType: 'Steps' as const,
    count,
    startTime: new Date(now - hoursAgo * hour).toISOString(),
    endTime: new Date(now - hoursAgo * hour + 20 * 60_000).toISOString(),
    metadata: { recordingMethod },
  });
  const ids = await insertRecords([
    record(3, 1200, 2),
    record(2, 900, 2),
    record(1, 600, 1),
    record(0.5, 5000, MANUAL_ENTRY),
  ]);
  return ids.length;
};
