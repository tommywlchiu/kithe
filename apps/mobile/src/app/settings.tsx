import { notifyHourOf } from '@kithe/core';
import { Link, router } from 'expo-router';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { tellTommy } from '../feedback/tellTommy';
import { useGame } from '../game/GameProvider';
import { askForNotifications } from '../notifications/schedule';
import { movementSource } from '../movement/movementSource';
import { Button } from '../ui/Button';
import { colors, radius, space } from '../ui/theme';

const NOTIFY_SLOTS: { label: string; hour: number | null }[] = [
  { label: 'Morning', hour: 8 },
  { label: 'Midday', hour: 12 },
  { label: 'Evening', hour: 18 },
  { label: 'Off', hour: null },
];

export default function Settings() {
  const { game, health, setResting, setNotificationHour, refresh, deleteEverything } = useGame();
  const hour = game ? notifyHourOf(game) : null;

  const chooseHour = async (next: number | null) => {
    if (next !== null) await askForNotifications();
    await setNotificationHour(next);
  };
  const name = game?.pet.name ?? 'your pup';

  const healthLine =
    health.kind === 'unsupported'
      ? 'Step counting is not available on this phone.'
      : health.kind === 'missing'
        ? 'Step counting is off.'
        : Platform.OS === 'ios'
          ? 'Steps come from Apple Health.'
          : 'Steps come from Health Connect.';

  const reconnect = async () => {
    try {
      await movementSource?.requestAccess();
    } finally {
      await refresh();
    }
  };

  const confirmDelete = () =>
    Alert.alert(
      'Delete everything?',
      `${name}, the diary, and all Pawprints will be gone from this phone. This cannot be undone.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteEverything();
            router.replace('/onboarding');
          },
        },
      ],
    );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body}>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.title}>Rest Mode</Text>
            <Text style={styles.detail}>
              Sick, injured, or traveling? {name} naps cozily and nothing changes until you are
              back.
            </Text>
          </View>
          <Switch
            value={game?.restMode ?? false}
            onValueChange={(on) => setResting(on)}
            trackColor={{ true: colors.sage, false: colors.line }}
            accessibilityLabel="Rest Mode"
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Daily note</Text>
        <Text style={styles.detail}>One cozy message a day from {name}. Never more.</Text>
        <View style={styles.chips}>
          {NOTIFY_SLOTS.map((slot) => {
            const selected = hour === slot.hour;
            return (
              <Pressable
                key={slot.label}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`Daily note: ${slot.label}`}
                onPress={() => void chooseHour(slot.hour)}
                style={[styles.chip, selected && styles.chipOn]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextOn]}>{slot.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Steps</Text>
        <Text style={styles.detail}>{healthLine} Your health data stays on this phone.</Text>
        {health.kind !== 'unsupported' ? (
          <Button label="Check step access" variant="quiet" onPress={reconnect} />
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Tell Tommy</Text>
        <Text style={styles.detail}>
          Something feel off, or something you love? I read every message.
        </Text>
        <Button
          label="Tell Tommy"
          variant="quiet"
          onPress={() => void tellTommy('settings', game)}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Your data</Text>
        <Button label="Delete my data" variant="quiet" onPress={confirmDelete} />
      </View>

      {__DEV__ ? (
        <Link href="/dev/movement" style={styles.devLink}>
          Health data spike (dev)
        </Link>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.oat },
  body: { padding: space.lg, gap: space.md },
  card: {
    backgroundColor: colors.cream,
    borderRadius: radius.lg,
    padding: space.md,
    gap: space.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rowText: { flex: 1, gap: space.xs },
  title: { fontSize: 18, fontWeight: '700', color: colors.ink },
  detail: { fontSize: 15, color: colors.inkSoft, lineHeight: 21 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.oat,
  },
  chipOn: { borderColor: colors.sage, backgroundColor: colors.sageSoft },
  chipText: { fontSize: 15, color: colors.inkSoft, fontWeight: '600' },
  chipTextOn: { color: colors.ink },
  devLink: { fontSize: 15, color: colors.terracottaDark, textAlign: 'center', marginTop: space.md },
});
