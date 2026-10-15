import { Link, router } from 'expo-router';
import { Alert, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { useGame } from '../game/GameProvider';
import { movementSource } from '../movement/movementSource';
import { Button } from '../ui/Button';
import { colors, radius, space } from '../ui/theme';

export default function Settings() {
  const { game, health, setResting, refresh, deleteEverything } = useGame();
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
        <Text style={styles.title}>Steps</Text>
        <Text style={styles.detail}>{healthLine} Your health data stays on this phone.</Text>
        {health.kind !== 'unsupported' ? (
          <Button label="Check step access" variant="quiet" onPress={reconnect} />
        ) : null}
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
  devLink: { fontSize: 15, color: colors.terracottaDark, textAlign: 'center', marginTop: space.md },
});
