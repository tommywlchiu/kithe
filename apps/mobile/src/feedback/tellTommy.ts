import type { GameState } from '@kithe/core';
import { daysBetween, localDate } from '@kithe/core';
import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';

import { track } from '../analytics/track';

const ADDRESS = 'marqueofficialhq@gmail.com';

/** Opens the mail app to Tommy with the details he needs to help, and nothing about health. */
export async function tellTommy(
  from: 'settings' | 'error',
  game: GameState | null,
  error?: string,
) {
  track('feedback_opened', { from });
  const day = game
    ? daysBetween(game.pet.adoptedOn, localDate(Date.now(), game.clock.homeTimeZone)) + 1
    : null;
  const details = [
    `App version: ${Constants.expoConfig?.version ?? 'dev'}`,
    `Phone: ${Platform.OS} ${String(Platform.Version)}`,
    day ? `Day ${day} with the pup` : 'Not adopted yet',
    error ? `Error: ${error.slice(0, 300)}` : null,
  ]
    .filter(Boolean)
    .join('\n');
  const subject = encodeURIComponent(from === 'error' ? 'Kithe hit a snag' : 'Kithe feedback');
  const body = encodeURIComponent(`\n\n\n---\n${details}`);
  await Linking.openURL(`mailto:${ADDRESS}?subject=${subject}&body=${body}`);
}
