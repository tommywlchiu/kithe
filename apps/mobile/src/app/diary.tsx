import { FlatList, StyleSheet, Text, View } from 'react-native';

import { useGame } from '../game/GameProvider';
import { colors, radius, space } from '../ui/theme';

const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

export default function Diary() {
  const { game } = useGame();
  const entries = game ? [...game.diary].reverse() : [];
  const today = game?.clock.lastDay;

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.body}
      data={entries}
      keyExtractor={(e, i) => `${e.date}-${e.lineId}-${i}`}
      ListEmptyComponent={<Text style={styles.empty}>Our story starts today.</Text>}
      renderItem={({ item }) => (
        <View style={[styles.entry, item.date === today && styles.today]}>
          <Text style={styles.date}>{item.date === today ? 'Today' : formatDate(item.date)}</Text>
          <Text style={styles.text}>{item.text}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.oat },
  body: { padding: space.lg, gap: space.md },
  empty: { fontSize: 18, color: colors.inkSoft, textAlign: 'center', marginTop: space.xl },
  entry: {
    backgroundColor: colors.cream,
    borderRadius: radius.lg,
    padding: space.md,
    gap: space.xs,
  },
  today: { borderWidth: 2, borderColor: colors.sage },
  date: { fontSize: 13, fontWeight: '700', color: colors.inkSoft, textTransform: 'uppercase' },
  text: { fontSize: 18, lineHeight: 26, color: colors.ink },
});
