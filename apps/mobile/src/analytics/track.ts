import {
  type AnalyticsEventName,
  buildEvent,
  daysBetween,
  type GameState,
  localDate,
} from '@kithe/core';
import Constants from 'expo-constants';
import Storage from 'expo-sqlite/kv-store';
import { Platform } from 'react-native';

// PostHog over plain HTTPS: its SDK pulls in native modules, and Phase 0 only needs capture.
// The project key is public and write-only. With no key configured, tracking is off.
const extra = (Constants.expoConfig?.extra ?? {}) as { posthogKey?: string; posthogHost?: string };
const KEY = extra.posthogKey;
const HOST = extra.posthogHost ?? 'https://us.i.posthog.com';
const ID_KEY = 'kithe.analytics.id';

let installId: string | null = null;
let installDay = 0;
let queue: { event: string; properties: Record<string, unknown>; timestamp: string }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function newId(): string {
  const hex = () => Math.floor(Math.random() * 16).toString(16);
  return Array.from({ length: 32 }, hex).join('');
}

function ensureId(): string {
  if (installId) return installId;
  installId = Storage.getItemSync(ID_KEY);
  if (!installId) {
    installId = newId();
    Storage.setItemSync(ID_KEY, installId);
  }
  return installId;
}

/** Forgets the install id, so a fresh adoption after Delete counts as a new install. */
export function resetTrackingId(): void {
  installId = null;
  queue = [];
}

/** Keeps install_day current; call whenever the game state changes. */
export function setTrackingContext(game: GameState | null): void {
  if (!game) return;
  installDay = Math.max(
    0,
    daysBetween(game.pet.adoptedOn, localDate(Date.now(), game.clock.homeTimeZone)),
  );
}

async function flush(): Promise<void> {
  timer = null;
  if (!KEY || queue.length === 0) return;
  const batch = queue;
  queue = [];
  try {
    await fetch(`${HOST}/batch/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: KEY,
        batch: batch.map((e) => ({ ...e, distinct_id: ensureId() })),
      }),
    });
  } catch {
    // Tracking never blocks or breaks the game; a lost batch is acceptable.
  }
}

export function track(event: AnalyticsEventName, props: Record<string, unknown> = {}): void {
  if (!KEY) return;
  const built = buildEvent(event, props, { installDay, platform: Platform.OS });
  queue.push({
    event: built.event,
    properties: { ...built.properties, app_version: Constants.expoConfig?.version ?? 'dev' },
    timestamp: new Date().toISOString(),
  });
  if (!timer) timer = setTimeout(() => void flush(), 5000);
}

/** Uncaught JavaScript errors become $exception events carrying the error type only. */
export function installErrorTracking(): void {
  const handler = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (!handler) return;
  const previous = handler.getGlobalHandler();
  handler.setGlobalHandler((error, isFatal) => {
    track('$exception', { $exception_type: error instanceof Error ? error.name : 'Error' });
    void flush();
    previous(error, isFatal);
  });
}

type ErrorUtilsLike = {
  getGlobalHandler: () => (error: unknown, isFatal?: boolean) => void;
  setGlobalHandler: (fn: (error: unknown, isFatal?: boolean) => void) => void;
};
