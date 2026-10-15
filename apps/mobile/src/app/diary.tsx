import { firstWeekRecap } from '@kithe/core';
import { useEffect } from 'react';
import { FlatList, Share, StyleSheet, Text, View } from 'react-native';

import { track } from '../analytics/track';
import { useGame } from '../game/GameProvider';
import { Button } from '../ui/Button';
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
  const recap = game ? firstWeekRecap(game) : null;
  const name = game?.pet.name ?? 'My pup';

  useEffect(() => {
    track('diary_opened');
    if (recap) track('recap_viewed');
    // Count each visit once, not every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const share = async () => {
    if (!recap) return;
    const lines = [
      `${name} and I: our first week. ${recap.daysTogether} days together, ${recap.goalDays} goal days.`,
      recap.bestLine ? `From ${name}'s diary: "${recap.bestLine}"` : null,
      'Kithe: a puppy that grows when you move.',
    ];
    const result = await Share.share({ message: lines.filter(Boolean).join('\n') });
    if (result.action === Share.sharedAction) track('recap_shared');
  };

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.body}
      data={entries}
      keyExtractor={(e, i) => `${e.date}-${e.lineId}-${i}`}
      ListHeaderComponent={
        recap ? (
          <View style={styles.recap} accessible accessibilityLabel="Our first week">
            <Text style={styles.recapTitle} accessibilityRole="header">
              Our first week
            </Text>
            <Text style={styles.recapStat}>
              {recap.daysTogether} days together · {recap.goalDays} goal days
            </Text>
            {recap.bestWalkDate ? (
              <Text style={styles.recapLine}>Favorite walk: {formatDate(recap.bestWalkDate)}</Text>
            ) : null}
            {recap.bestLine ? <Text style={styles.recapQuote}>“{recap.bestLine}”</Text> : null}
            <Button label="Share our week" onPress={share} />
          </View>
        ) : null
      }
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
  recap: {
    backgroundColor: colors.sageSoft,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
    marginBottom: space.sm,
  },
  recapTitle: { fontSize: 24, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  recapStat: { fontSize: 17, fontWeight: '600', color: colors.ink, textAlign: 'center' },
  recapLine: { fontSize: 15, color: colors.inkSoft, textAlign: 'center' },
  recapQuote: { fontSize: 17, fontStyle: 'italic', color: colors.ink, textAlign: 'center' },
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
