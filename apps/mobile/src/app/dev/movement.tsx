import { type DayMovement, lastNDates, type MovementAccess } from '@kithe/core';
import * as Notifications from 'expo-notifications';
import { Redirect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { todayLocal } from '../../movement/localDay';
import { movementSource, seedTestSteps } from '../../movement/movementSource';

// T7 spike screen: proves the health read path on a real device. Development builds only:
// the guard runs before the inner screen mounts, so store builds never touch the health APIs.
export default function MovementSpikeRoute() {
  return __DEV__ ? <MovementSpikeScreen /> : <Redirect href="/" />;
}

function MovementSpikeScreen() {
  const [availability, setAvailability] = useState('checking');
  const [access, setAccess] = useState<MovementAccess | null>(null);
  const [days, setDays] = useState<DayMovement[]>([]);
  const [readMs, setReadMs] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [scheduled, setScheduled] = useState<string[]>([]);

  const read = useCallback(async () => {
    if (!movementSource) return;
    const started = Date.now();
    setDays(await movementSource.readDays(lastNDates(todayLocal(), 7)));
    setReadMs(Date.now() - started);
  }, []);

  useEffect(() => {
    Notifications.getAllScheduledNotificationsAsync()
      .then((all) =>
        setScheduled(
          all.map((n) => {
            const t = n.trigger as { value?: number; date?: number } | null;
            const at = t?.value ?? t?.date;
            return `${at ? new Date(at).toLocaleString() : '?'}: ${n.content.body ?? ''}`;
          }),
        ),
      )
      .catch(() => setScheduled([]));
    movementSource
      ?.availability()
      .then(setAvailability)
      .catch((error: unknown) => setAvailability(`error: ${String(error)}`));
    movementSource
      ?.getAccess()
      .then(setAccess)
      .catch(() => setAccess(null));
  }, []);

  if (!movementSource) {
    return (
      <View style={styles.screen}>
        <Text style={styles.text}>No health store on this platform.</Text>
      </View>
    );
  }

  const run = (label: string, action: () => Promise<unknown>) => async () => {
    setMessage(`${label}...`);
    try {
      await action();
      setMessage(`${label}: done`);
    } catch (error) {
      setMessage(`${label} failed: ${String(error)}`);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.text}>Source: {movementSource.platform}</Text>
      <Text style={styles.text}>Availability: {availability}</Text>
      <Text style={styles.text}>
        Access:{' '}
        {access ? JSON.stringify(access) : 'unknown (HealthKit hides grants, or not requested)'}
      </Text>

      <Button
        label="Request access"
        onPress={run('request access', async () =>
          setAccess(await movementSource!.requestAccess()),
        )}
      />
      <Button label="Read last 7 days" onPress={run('read', read)} />
      {seedTestSteps ? (
        <Button
          label="Seed test steps (dev)"
          onPress={run('seed', async () => {
            await seedTestSteps!();
            await read();
          })}
        />
      ) : null}

      <Text style={styles.meta}>{message}</Text>
      <Text style={styles.text}>Scheduled notifications: {scheduled.length}</Text>
      {scheduled.map((line) => (
        <Text key={line} style={styles.meta}>
          {line}
        </Text>
      ))}
      {readMs !== null ? <Text style={styles.meta}>7-day read took {readMs} ms</Text> : null}

      <View style={styles.row}>
        {['Date', 'Steps', 'Ex min', 'Pushes', 'Manual'].map((h) => (
          <Text key={h} style={[styles.cell, styles.head]}>
            {h}
          </Text>
        ))}
      </View>
      {days.map((d) => (
        <View key={d.date} style={styles.row}>
          <Text style={styles.cell}>{d.date.slice(5)}</Text>
          <Text style={styles.cell}>{d.steps}</Text>
          <Text style={styles.cell}>{d.exerciseMinutes}</Text>
          <Text style={styles.cell}>{d.wheelchairPushes}</Text>
          <Text style={styles.cell}>{d.manualRecordsExcluded}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function Button({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.button}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F1E7' },
  content: { padding: 20, gap: 10 },
  text: { fontSize: 16, color: '#3B2F2A' },
  meta: { fontSize: 13, color: '#8A7A70' },
  button: {
    backgroundColor: '#C9704A',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row' },
  cell: { flex: 1, fontSize: 14, color: '#3B2F2A', paddingVertical: 4 },
  head: { fontWeight: '700' },
});
