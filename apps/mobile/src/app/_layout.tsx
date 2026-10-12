import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#F6F1E7' },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="diary" options={{ headerShown: true, title: 'Diary' }} />
        <Stack.Screen name="settings" options={{ headerShown: true, title: 'Settings' }} />
      </Stack>
    </>
  );
}
