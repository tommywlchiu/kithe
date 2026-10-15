import { breeds, goalConfig } from '@kithe/content';
import { addDays, lastNDates, type MovementGoal, startingGoal } from '@kithe/core';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGame } from '../game/GameProvider';
import { todayLocal } from '../movement/localDay';
import { movementSource } from '../movement/movementSource';
import { Button } from '../ui/Button';
import { PupArt } from '../ui/PupArt';
import { colors, radius, space } from '../ui/theme';

type Step = 'meet' | 'name' | 'explain' | 'goal';

const TYPICAL_STEPS = [
  { label: 'Under 3,000', steps: 2500 },
  { label: '3,000 to 6,000', steps: 4500 },
  { label: '6,000 to 9,000', steps: 7500 },
  { label: 'Over 9,000', steps: 10000 },
];

/** iOS has Health history to average; Android usually does not, so we ask. */
async function goalFromHistory(): Promise<MovementGoal | null> {
  if (!movementSource || Platform.OS !== 'ios') return null;
  try {
    const days = await movementSource.readDays(lastNDates(addDays(todayLocal(), -1), 14));
    const goal = startingGoal(
      {
        kind: 'history',
        dailySteps: days.map((d) => d.steps),
        dailyExerciseMinutes: days.map((d) => d.exerciseMinutes),
      },
      goalConfig,
    );
    return days.some((d) => d.steps > 0) ? goal : null;
  } catch {
    return null;
  }
}

export default function Onboarding() {
  const { adoptPet } = useGame();
  const [step, setStep] = useState<Step>('meet');
  const [breed, setBreed] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const trimmed = name.trim();

  const finish = async (goal: MovementGoal) => {
    if (!breed) return;
    setBusy(true);
    await adoptPet({ name: trimmed, breed, startingGoal: goal });
    router.replace('/');
  };

  const connectHealth = async () => {
    setBusy(true);
    try {
      await movementSource?.requestAccess();
    } catch {
      // The game works without access; Settings offers to reconnect later.
    }
    const goal = await goalFromHistory();
    setBusy(false);
    if (goal) await finish(goal);
    else setStep('goal');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {step === 'meet' && (
            <>
              <Text style={styles.title} accessibilityRole="header">
                Meet the pups.
              </Text>
              <Text style={styles.lede}>One of them is waiting for you.</Text>
              {breeds.map((b) => (
                <Pressable
                  key={b.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Choose the ${b.name} puppy`}
                  onPress={() => {
                    setBreed(b.id);
                    setStep('name');
                  }}
                  style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                >
                  <PupArt breed={b.id} pose="content" name={b.name} size={150} />
                  <Text style={styles.cardName}>{b.name}</Text>
                </Pressable>
              ))}
            </>
          )}

          {step === 'name' && breed && (
            <>
              <PupArt breed={breed} pose="thriving" name="Your pup" size={220} />
              <Text style={styles.title} accessibilityRole="header">
                What&apos;s my name?
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Biscuit"
                maxLength={20}
                autoFocus
                autoCapitalize="words"
                accessibilityLabel="Your pup's name"
                style={styles.input}
                returnKeyType="done"
                onSubmitEditing={() => trimmed && setStep('explain')}
              />
              <Button label="That's me" disabled={!trimmed} onPress={() => setStep('explain')} />
            </>
          )}

          {step === 'explain' && breed && (
            <>
              <PupArt breed={breed} pose="content" name={trimmed} size={220} />
              <Text style={styles.title} accessibilityRole="header">
                Our walks feed me.
              </Text>
              <Text style={styles.lede}>
                Your steps become Pawprints for my meals and toys. May I count them?
              </Text>
              <Text style={styles.note}>
                Your health data stays on your phone.
                {Platform.OS === 'android' ? ' Health Connect may say hello first.' : ''}
              </Text>
              <Button label="Count our steps" disabled={busy} onPress={connectHealth} />
              <Button label="Maybe later" variant="quiet" onPress={() => setStep('goal')} />
            </>
          )}

          {step === 'goal' && (
            <>
              <Text style={styles.title} accessibilityRole="header">
                How much do you walk?
              </Text>
              <Text style={styles.lede}>On a normal day. Your goal adjusts as we go.</Text>
              {TYPICAL_STEPS.map((option) => (
                <Button
                  key={option.label}
                  label={option.label}
                  variant="quiet"
                  disabled={busy}
                  onPress={() =>
                    finish(startingGoal({ kind: 'answer', typicalSteps: option.steps }, goalConfig))
                  }
                />
              ))}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.oat },
  fill: { flex: 1 },
  body: { padding: space.lg, gap: space.md, alignItems: 'stretch' },
  title: { fontSize: 30, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  lede: { fontSize: 18, color: colors.inkSoft, textAlign: 'center' },
  note: { fontSize: 15, color: colors.inkSoft, textAlign: 'center' },
  card: {
    backgroundColor: colors.cream,
    borderRadius: radius.lg,
    padding: space.md,
    alignItems: 'center',
    gap: space.sm,
  },
  cardPressed: { opacity: 0.8 },
  cardName: { fontSize: 20, fontWeight: '700', color: colors.ink },
  input: {
    backgroundColor: colors.cream,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontSize: 20,
    color: colors.ink,
    textAlign: 'center',
  },
});
