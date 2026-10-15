import type { GameState } from '@kithe/core';
import Storage from 'expo-sqlite/kv-store';

const KEY = 'kithe.game';
const CURRENT_VERSION = 1;

export type LoadResult =
  | { kind: 'empty' }
  | { kind: 'loaded'; state: GameState }
  /** The save could not be read; it was kept under `keptAs` and never overwritten. */
  | { kind: 'unreadable'; keptAs: string };

function looksLikeGame(value: unknown): value is GameState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<GameState>;
  return (
    v.version === CURRENT_VERSION &&
    typeof v.pet?.name === 'string' &&
    typeof v.clock?.lastDay === 'string' &&
    Array.isArray(v.care?.ledger) &&
    Array.isArray(v.days) &&
    v.days.length > 0
  );
}

export async function loadGame(): Promise<LoadResult> {
  const raw = await Storage.getItemAsync(KEY);
  if (raw === null) return { kind: 'empty' };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (looksLikeGame(parsed)) return { kind: 'loaded', state: parsed };
  } catch {
    // fall through: keep the unreadable save aside
  }
  const keptAs = `${KEY}.unreadable.${Date.now()}`;
  await Storage.setItemAsync(keptAs, raw);
  await Storage.removeItemAsync(KEY);
  return { kind: 'unreadable', keptAs };
}

export async function saveGame(state: GameState): Promise<void> {
  await Storage.setItemAsync(KEY, JSON.stringify(state));
}

/** Settings > Delete my data. Also clears any set-aside saves. */
export async function deleteAllData(): Promise<void> {
  for (const key of Storage.getAllKeysSync()) {
    if (key.startsWith(KEY)) Storage.removeItemSync(key);
  }
}
