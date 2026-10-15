import { copy } from '@kithe/content';
import { type GameState, notifyHourOf, planNotifications } from '@kithe/core';
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

export async function notificationsAllowed(): Promise<boolean> {
  return (await Notifications.getPermissionsAsync()).granted;
}

/** Asks once, after adoption. Returns whether notifications may be shown. */
export async function askForNotifications(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Daily pup news',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || !current.canAskAgain) return current.granted;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/**
 * Replaces the schedule with one good-news message a day for the next week, at the player's
 * hour. Nothing is scheduled in Rest Mode, when turned off, or without permission. Safe to
 * call often: it always rebuilds from the game state, so it never doubles up.
 */
export async function rescheduleDaily(game: GameState): Promise<number> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const hour = notifyHourOf(game);
  if (game.restMode || hour === null || !(await notificationsAllowed())) return 0;
  const plan = planNotifications(game, copy.notifications, game.clock.lastDay, DAYS_AHEAD);
  const now = Date.now();
  let scheduled = 0;
  for (const { date, text } of plan) {
    const [y, m, d] = date.split('-').map(Number) as [number, number, number];
    const at = new Date(y, m - 1, d, hour, 0, 0);
    if (at.getTime() <= now) continue;
    await Notifications.scheduleNotificationAsync({
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
