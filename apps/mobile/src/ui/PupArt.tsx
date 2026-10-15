import type { ArtState } from '@kithe/core';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { pupImage } from './pupImages';
import { colors, radius } from './theme';

export type PupPose = ArtState | 'eating';

const describe: Record<PupPose, string> = {
  thriving: 'wagging, full of energy',
  content: 'sitting calmly',
  mopey: 'resting chin on paws',
  sleeping: 'curled up asleep',
  eating: 'eating from the bowl',
};

/** The pup as Phase 0 concept art, always labeled so testers know it is a placeholder. */
export function PupArt({
  breed,
  pose,
  name,
  size = 260,
}: {
  breed: string;
  pose: PupPose;
  name: string;
  size?: number;
}) {
  const source = pupImage(breed, pose);
  const label = `${name}, ${describe[pose]}`;
  return (
    <View style={styles.wrap}>
      {source ? (
        <Image
          source={source}
          style={{ width: size, height: size }}
          contentFit="contain"
          accessibilityLabel={label}
        />
      ) : (
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={label}
          style={[styles.placeholder, { width: size, height: size }]}
        >
          <Text style={styles.placeholderBreed}>{breed}</Text>
          <Text style={styles.placeholderPose}>{describe[pose]}</Text>
        </View>
      )}
      <Text style={styles.caption}>Concept art</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  placeholder: {
    borderRadius: radius.lg,
    backgroundColor: '#E8D3BC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  placeholderBreed: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
    textTransform: 'capitalize',
  },
  placeholderPose: { fontSize: 16, color: colors.inkSoft, marginTop: 6, textAlign: 'center' },
  caption: { fontSize: 12, color: colors.inkSoft, marginTop: 6 },
});
