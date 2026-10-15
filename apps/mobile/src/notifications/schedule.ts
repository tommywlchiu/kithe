import { copy } from '@kithe/content';
import { addDays, type GameState, instantAt, notifyHourOf, planNotifications } from '@kithe/core';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL = 'daily';
const DAYS_AHEAD = 7;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Daily pup news',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function notificationsAllowed(): Promise<boolean> {
  return (await Notifications.getPermissionsAsync()).granted;
}

/** Asks once, after adoption. Returns whether notifications may be shown. */
export async function askForNotifications(): Promise<boolean> {
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || !current.canAskAgain) return current.granted;
  return (await Notifications.requestPermissionsAsync()).granted;
}

// Every change to the schedule runs one at a time: overlapping rebuilds would each cancel,
// then each add a week.
let pending: Promise<unknown> = Promise.resolve();

function serially<T>(job: () => Promise<T>): Promise<T> {
  const run = pending.then(job);
  pending = run.catch(() => undefined);
  return run;
}

/** Delete my data: nothing from the old pup may arrive afterwards. */
export function cancelAllNotes(): Promise<void> {
  return serially(() => Notifications.cancelAllScheduledNotificationsAsync());
}

/**
 * Replaces the schedule with one good-news message a day, today included when its hour is
 * still ahead, at the player's hour in the home time zone. Nothing is scheduled in Rest Mode,
 * when turned off, or without permission. Safe to call often: it always rebuilds from the
 * game state, so it never doubles up.
 */
export function rescheduleDaily(game: GameState): Promise<number> {
  return serially(() => rebuild(game));
}

async function rebuild(game: GameState): Promise<number> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const hour = notifyHourOf(game);
  if (game.restMode || hour === null || !(await notificationsAllowed())) return 0;
  await ensureChannel();
  const today = game.clock.lastDay;
  const plan = planNotifications(game, copy.notifications, addDays(today, -1), DAYS_AHEAD);
  const now = Date.now();
  let scheduled = 0;
  for (const { date, text } of plan) {
    // Adoption day already had its welcome; the first note is the next morning's.
    if (date === game.pet.adoptedOn) continue;
    const at = instantAt(date, hour, game.clock.homeTimeZone);
    if (at <= now) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: `daily-${date}`,
      content: { title: game.pet.name, body: text, data: { url: '/diary' } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: at,
        ...(Platform.OS === 'android' ? { channelId: CHANNEL } : {}),
      },
    });
    scheduled += 1;
  }
  return scheduled;
}
