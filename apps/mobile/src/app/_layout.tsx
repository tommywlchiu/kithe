import * as Notifications from 'expo-notifications';
import { type ErrorBoundaryProps, router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { installErrorTracking, track } from '../analytics/track';
import { tellTommy } from '../feedback/tellTommy';
import { GameProvider } from '../game/GameProvider';
import { Button } from '../ui/Button';
import { colors, space } from '../ui/theme';

installErrorTracking();

let lastHandled: string | null = null;

/** Each tap opens the diary once, whether it arrives as the launch response or as an event. */
function openFromNotification(response: Notifications.NotificationResponse | null) {
  if (!response) return;
  Notifications.clearLastNotificationResponse();
  const tap = `${response.notification.request.identifier}@${response.notification.date}`;
  if (tap === lastHandled) return;
  lastHandled = tap;
  if (response.notification.request.content.data?.url === '/diary') {
    track('notification_opened');
    router.push('/diary');
  }
}

export default function RootLayout() {
  useEffect(() => {
    openFromNotification(Notifications.getLastNotificationResponse());
    const sub = Notifications.addNotificationResponseReceivedListener(openFromNotification);
    return () => sub.remove();
  }, []);

  return (
    <GameProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.oat },
          headerStyle: { backgroundColor: colors.oat },
          headerTintColor: colors.ink,
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="diary" options={{ headerShown: true, title: 'Diary' }} />
        <Stack.Screen name="settings" options={{ headerShown: true, title: 'Settings' }} />
        <Stack.Screen name="dev/movement" options={{ headerShown: true, title: 'Health spike' }} />
      </Stack>
    </GameProvider>
  );
}

/** Every error screen has one obvious next step, and Tommy is one tap away. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.error}>
      <Text style={styles.title}>Oops, I tripped over my own paws.</Text>
      <Text style={styles.body}>Your pup and Pawprints are safe.</Text>
      <Button label="Try again" onPress={() => void retry()} />
      <Button
        label="Tell Tommy"
        variant="quiet"
        onPress={() => void tellTommy('error', null, error.message)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  error: {
    flex: 1,
    backgroundColor: colors.oat,
    padding: space.lg,
    justifyContent: 'center',
    gap: space.md,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  body: { fontSize: 17, color: colors.inkSoft, textAlign: 'center' },
});
