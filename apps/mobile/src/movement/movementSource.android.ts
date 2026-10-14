import {
  combineSourceRecords,
  type DayMovement,
  type DayWindow,
  type MovementAccess,
  type MovementSource,
  type SourceRecord,
} from '@kithe/core';
import {
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

type RecordType = 'Steps' | 'ExerciseSession' | 'WheelchairPushes';

const READS = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'ExerciseSession' },
  { accessType: 'read', recordType: 'WheelchairPushes' },
] as const;

// Cache only a successful initialize, so the app recovers once Health Connect is installed
// or updated instead of failing for the rest of the process.
let ready = false;
async function ensureInitialized() {
  if (ready) return;
  if (!(await initialize())) throw new Error('Health Connect is not ready on this device');
  ready = true;
}

function toAccess(granted: readonly { accessType: string; recordType?: string }[]): MovementAccess {
  const has = (recordType: RecordType) =>
    granted.some((p) => p.accessType === 'read' && p.recordType === recordType);
  return {
    steps: has('Steps'),
    exercise: has('ExerciseSession'),
    wheelchairPushes: has('WheelchairPushes'),
  };
}

// One paginated read per type for the whole window keeps the call count flat as the window
// grows (Health Connect rate-limits foreground reads). Combining happens in @kithe/core.
async function readSourceRecords(type: RecordType, start: Date, end: Date) {
  const records: SourceRecord[] = [];
  let pageToken: string | undefined;
  do {
    const page = await readRecords(type, {
      timeRangeFilter: {
        operator: 'between',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      },
      pageToken,
    });
    for (const record of page.records) {
      const startMs = new Date(record.startTime).getTime();
      const endMs = new Date(record.endTime).getTime();
      const amount =
        type === 'ExerciseSession'
          ? (endMs - startMs) / 60_000
          : 'count' in record && typeof record.count === 'number'
            ? record.count
            : 0;
      records.push({
        origin: record.metadata?.dataOrigin ?? 'unknown',
        startMs,
        endMs,
        amount,
        manual: record.metadata?.recordingMethod === MANUAL_ENTRY,
      });
    }
    pageToken = page.pageToken || undefined;
  } while (pageToken);
  return records;
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
    if (dates.length === 0) return [];
    await ensureInitialized();
    const access = toAccess(await getGrantedPermissions());
    const windows: DayWindow[] = dates.map((date) => {
      const { start, end } = localDayBounds(date);
      return { date, startMs: start.getTime(), endMs: end.getTime() };
    });
    const start = new Date(Math.min(...windows.map((w) => w.startMs)));
    const end = new Date(Math.max(...windows.map((w) => w.endMs)));
    const totalsFor = async (type: RecordType, granted: boolean) =>
      combineSourceRecords(granted ? await readSourceRecords(type, start, end) : [], windows);
    const [steps, exercise, pushes] = await Promise.all([
      totalsFor('Steps', access.steps),
      totalsFor('ExerciseSession', access.exercise),
      totalsFor('WheelchairPushes', access.wheelchairPushes),
    ]);
    return dates.map((date, i): DayMovement => ({
      date,
      steps: Math.round(steps[i]!.amount),
      exerciseMinutes: Math.round(exercise[i]!.amount),
      wheelchairPushes: Math.round(pushes[i]!.amount),
      manualRecordsExcluded:
        steps[i]!.manualRecords + exercise[i]!.manualRecords + pushes[i]!.manualRecords,
    }));
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
