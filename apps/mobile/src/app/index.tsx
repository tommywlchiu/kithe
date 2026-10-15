import { careConfig, gameConfig, items } from '@kithe/content';
import { type CareAction, currentTrick, view } from '@kithe/core';
import { Link, Redirect } from 'expo-router';
import Storage from 'expo-sqlite/kv-store';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGame } from '../game/GameProvider';
import { askForNotifications } from '../notifications/schedule';
import { Button } from '../ui/Button';
import { PupArt, type PupPose } from '../ui/PupArt';
import { colors, radius, space } from '../ui/theme';

const ASKED_KEY = 'kithe.notifications.asked';
const trickName = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);

const thanks: Record<CareAction['type'], string> = {
  meal: 'Crunch crunch. Thank you!',
  treat: 'A treat! You are the best.',
  brushing: 'So shiny now.',
  buyToy: 'A new toy, for me?',
  play: 'Again! Again!',
  trainingSession: 'I am learning. Watch me.',
};

const refusals: Record<string, string> = {
  notEnoughPawprints: 'A short walk would earn a few more Pawprints.',
  noUsableToy: 'Let us pick out a toy first.',
  trickAlreadyLearned: 'I already know that one!',
};

export default function Home() {
  const { status, game, health, care, refresh } = useGame();
  const [pose, setPose] = useState<PupPose | null>(null);
  const [message, setMessage] = useState('');
  const [shopOpen, setShopOpen] = useState(false);
  const petName = game?.pet.name;

  // Ask once, after adoption, never before: one cozy note a day.
  useEffect(() => {
    if (status !== 'ready' || !petName || Storage.getItemSync(ASKED_KEY)) return;
    Storage.setItemSync(ASKED_KEY, '1');
    Alert.alert(`A note from ${petName}`, 'May I send you one cozy note a day?', [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Yes',
        onPress: async () => {
          await askForNotifications();
          await refresh();
        },
      },
    ]);
  }, [status, petName, refresh]);

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.terracotta} />
      </View>
    );
  }
  if (status === 'needs-adoption' || !game) return <Redirect href="/onboarding" />;

  const v = view(game, gameConfig);
  const name = game.pet.name;
  const progress = Math.min(1, v.today.progress);
  const usableToy = game.care.toys.find((t) => t.wearDaysLeft > 0);
  const trick = currentTrick(game, gameConfig);

  const doCare = async (action: CareAction) => {
    const outcome = await care(action);
    if (!outcome.ok) {
      setMessage(refusals[outcome.reason] ?? 'Maybe later.');
      return;
    }
    setMessage(
      outcome.fired.length > 0
        ? 'My tummy is a little grumbly. Plain food for me.'
        : thanks[action.type],
    );
    if (action.type === 'meal' || action.type === 'treat') {
      setPose('eating');
      setTimeout(() => setPose(null), 2500);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.header}>
          <Text style={styles.name} accessibilityRole="header">
            {name}
          </Text>
          <Text style={styles.meta}>
            {v.daysTogether === 0
              ? 'Our first day'
              : `${v.daysTogether} ${v.daysTogether === 1 ? 'day' : 'days'} together`}
            {game.restMode ? ' · Resting' : ''}
          </Text>
        </View>

        <PupArt breed={game.pet.breed} pose={pose ?? v.art} name={name} />
        {message ? (
          <Text style={styles.speech} accessibilityLiveRegion="polite">
            {message}
          </Text>
        ) : null}

        {health.kind === 'missing' ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>Let&apos;s turn step counting back on.</Text>
            <Link href="/settings" style={styles.noticeLink}>
              Reconnect
            </Link>
          </View>
        ) : null}

        <View
          style={styles.progressWrap}
          accessible
          accessibilityLabel={`Today's walk: ${Math.round(v.today.progress * 100)} percent of our goal. ${v.balance} Pawprints.`}
        >
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.meta}>
            {v.today.progress >= 1 ? 'Goal reached today' : 'Today’s walk'} · {v.balance} Pawprints
          </Text>
        </View>

        <View style={styles.grid}>
          <CareTile
            label="Bowl"
            detail={`${careConfig.prices.meal}`}
            hint={`Feed ${name} a meal`}
            onPress={() => doCare({ type: 'meal' })}
          />
          <CareTile
            label="Brush"
            detail={`${careConfig.prices.brushing}`}
            hint={`Brush ${name}`}
            onPress={() => doCare({ type: 'brushing' })}
          />
          <CareTile
            label="Toys"
            detail={usableToy ? 'Play' : 'Pick one'}
            hint={usableToy ? `Play with ${name}` : 'Open the toy shop'}
            onPress={() =>
              usableToy ? doCare({ type: 'play', toyId: usableToy.toyId }) : setShopOpen(true)
            }
          />
          <CareTile
            label="Treat"
            detail={`${careConfig.prices.treat}`}
            hint={`Give ${name} a treat`}
            onPress={() => doCare({ type: 'treat' })}
          />
          <CareTile
            label={trick ? `Train: ${trickName(trick)}` : 'All tricks learned'}
            detail={trick ? `${careConfig.prices.trainingSession}` : 'Good pup'}
            hint={trick ? `Practice ${trick} with ${name}` : `${name} knows every trick`}
            disabled={!trick}
            onPress={() => trick && doCare({ type: 'trainingSession', trickId: trick })}
          />
          <CareTile
            label="Shop"
            detail="Toys"
            hint="Open the toy shop"
            onPress={() => setShopOpen(true)}
          />
        </View>

        {v.todaysDiary ? (
          <Link href="/diary" style={styles.diaryLink}>
            {`${name}'s diary: “${v.todaysDiary.text}”`}
          </Link>
        ) : null}
        <View style={styles.footer}>
          <Link href="/diary" style={styles.footerLink}>
            Diary
          </Link>
          <Link href="/settings" style={styles.footerLink}>
            Settings
          </Link>
        </View>
      </ScrollView>

      <Modal
        visible={shopOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setShopOpen(false)}
      >
        <Pressable
          style={styles.scrim}
          onPress={() => setShopOpen(false)}
          accessibilityLabel="Close the shop"
        />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle} accessibilityRole="header">
            Toy basket
          </Text>
          <Text style={styles.meta}>{v.balance} Pawprints · toys last about two weeks</Text>
          {Object.entries(careConfig.toys).map(([id, toy]) => (
            <Button
              key={id}
              variant="quiet"
              label={`${items.items[id]?.name ?? id} · ${toy.price}`}
              onPress={async () => {
                setShopOpen(false);
                await doCare({ type: 'buyToy', toyId: id });
              }}
            />
          ))}
          <Button label="Close" onPress={() => setShopOpen(false)} />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function CareTile({
  label,
  detail,
  hint,
  onPress,
  disabled,
}: {
  label: string;
  detail: string;
  hint: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, (pressed || disabled) && styles.tileDim]}
    >
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileDetail}>{detail}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.oat },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.oat },
  body: { padding: space.lg, gap: space.md },
  header: { alignItems: 'center' },
  name: { fontSize: 32, fontWeight: '800', color: colors.ink },
  meta: { fontSize: 14, color: colors.inkSoft, textAlign: 'center' },
  speech: { fontSize: 18, color: colors.ink, textAlign: 'center', fontStyle: 'italic' },
  notice: {
    backgroundColor: colors.sageSoft,
    borderRadius: radius.md,
    padding: space.md,
    alignItems: 'center',
    gap: space.sm,
  },
  noticeText: { fontSize: 16, color: colors.ink, textAlign: 'center' },
  noticeLink: { fontSize: 16, fontWeight: '700', color: colors.terracottaDark },
  progressWrap: { gap: space.sm },
  progressTrack: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.cream,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.sage },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center' },
  tile: {
    width: '31%',
    minHeight: 84,
    backgroundColor: colors.cream,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.sm,
  },
  tileDim: { opacity: 0.6 },
  tileLabel: { fontSize: 17, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  tileDetail: { fontSize: 13, color: colors.inkSoft, marginTop: 2 },
  diaryLink: { fontSize: 15, color: colors.inkSoft, textAlign: 'center', fontStyle: 'italic' },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: space.xl },
  footerLink: { fontSize: 17, fontWeight: '600', color: colors.terracottaDark },
  scrim: { flex: 1, backgroundColor: 'rgba(59,47,42,0.35)' },
  sheet: {
    backgroundColor: colors.oat,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
  },
  sheetTitle: { fontSize: 22, fontWeight: '800', color: colors.ink, textAlign: 'center' },
});
