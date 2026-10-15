import { gameConfig } from '@kithe/content';
import {
  act,
  type ActOutcome,
  adopt,
  type AdoptInput,
  advanceToNow,
  type CareAction,
  type DayCounts,
  type GameState,
  type MovementAccess,
  setRestMode,
  syncMovement,
} from '@kithe/core';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import { movementSource } from '../movement/movementSource';
import { deleteAllData, loadGame, saveGame } from '../storage/save';

export type HealthStatus =
  | { kind: 'unsupported' }
  | { kind: 'ok'; access: MovementAccess | null }
  /** Some or all reads were revoked: show "reconnect", never a mopey day. */
  | { kind: 'missing'; access: MovementAccess };

type Status = 'loading' | 'needs-adoption' | 'ready';

type GameContextValue = {
  status: Status;
  game: GameState | null;
  health: HealthStatus;
  adoptPet: (input: Omit<AdoptInput, 'nowMs' | 'seed' | 'timeZone'>) => Promise<void>;
  care: (action: CareAction) => Promise<ActOutcome>;
  setResting: (on: boolean) => Promise<void>;
  refresh: () => Promise<void>;
  deleteEverything: () => Promise<void>;
};

const GameContext = createContext<GameContextValue | null>(null);

const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

async function readHealth(): Promise<HealthStatus> {
  if (!movementSource) return { kind: 'unsupported' };
  try {
    const access = await movementSource.getAccess();
    if (access && !(access.steps || access.exercise || access.wheelchairPushes)) {
      return { kind: 'missing', access };
    }
    return { kind: 'ok', access };
  } catch {
    return { kind: 'unsupported' };
  }
}

/** Movement for the days that can still sync (the last 7), keyed by date. */
async function readMovement(game: GameState): Promise<Record<string, DayCounts>> {
  if (!movementSource) return {};
  const dates = game.days.slice(-7).map((d) => d.date);
  try {
    const days = await movementSource.readDays(dates);
    return Object.fromEntries(
      days.map((d) => [
        d.date,
        {
          steps: d.steps,
          exerciseMinutes: d.exerciseMinutes,
          wheelchairPushes: d.wheelchairPushes,
        },
      ]),
    );
  } catch {
    return {};
  }
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [game, setGame] = useState<GameState | null>(null);
  const [health, setHealth] = useState<HealthStatus>({ kind: 'ok', access: null });
  const latest = useRef<GameState | null>(null);

  const commit = useCallback(async (next: GameState) => {
    latest.current = next;
    setGame(next);
    await saveGame(next);
  }, []);

  const refresh = useCallback(async () => {
    const current = latest.current;
    if (!current) return;
    let next = advanceToNow(current, Date.now(), gameConfig);
    const [movement, healthNow] = await Promise.all([readMovement(next), readHealth()]);
    setHealth(healthNow);
    next = syncMovement(next, movement, gameConfig);
    if (next !== current) await commit(next);
  }, [commit]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await loadGame();
      if (cancelled) return;
      if (result.kind === 'loaded') {
        latest.current = result.state;
        setGame(result.state);
        setStatus('ready');
        await refresh();
      } else {
        setStatus('needs-adoption');
      }
    })();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [refresh]);

  const adoptPet = useCallback<GameContextValue['adoptPet']>(
    async (input) => {
      const adopted = adopt(
        {
          ...input,
          nowMs: Date.now(),
          timeZone: deviceTimeZone(),
          seed: Math.floor(Math.random() * 2 ** 31),
        },
        gameConfig,
      );
      await commit(adopted);
      setStatus('ready');
      await refresh();
    },
    [commit, refresh],
  );

  const care = useCallback<GameContextValue['care']>(
    async (action) => {
      const current = latest.current;
      if (!current) return { ok: false, reason: 'noGame' };
      const outcome = act(current, action, gameConfig);
      if (outcome.ok) await commit(outcome.state);
      return outcome;
    },
    [commit],
  );

  const setResting = useCallback(
    async (on: boolean) => {
      if (latest.current) await commit(setRestMode(latest.current, on));
    },
    [commit],
  );

  const deleteEverything = useCallback(async () => {
    await deleteAllData();
    latest.current = null;
    setGame(null);
    setStatus('needs-adoption');
  }, []);

  return (
    <GameContext.Provider
      value={{ status, game, health, adoptPet, care, setResting, refresh, deleteEverything }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame(): GameContextValue {
  const value = useContext(GameContext);
  if (!value) throw new Error('useGame must be used inside GameProvider');
  return value;
}
