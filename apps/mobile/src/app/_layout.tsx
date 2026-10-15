import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { GameProvider } from '../game/GameProvider';
import { colors } from '../ui/theme';

export default function RootLayout() {
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
