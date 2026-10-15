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
  lastNDates,
  localDate,
  type MovementAccess,
  notifyHourOf,
  setNotifyHour,
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

import { setTrackingContext, track } from '../analytics/track';
import { movementSource } from '../movement/movementSource';
import { rescheduleDaily } from '../notifications/schedule';
import { deleteAllData, loadGame, saveGame } from '../storage/save';

export type HealthStatus =
  | { kind: 'unsupported' }
  | { kind: 'ok'; access: MovementAccess | null }
  /** Every read was revoked: show "reconnect", never a mopey day. */
  | { kind: 'missing'; access: MovementAccess };

type Status = 'loading' | 'needs-adoption' | 'ready';

type GameContextValue = {
  status: Status;
  game: GameState | null;
  health: HealthStatus;
  /** Set when a save could not be read; it was kept aside instead of being overwritten. */
  unreadableSave: boolean;
  adoptPet: (input: Omit<AdoptInput, 'nowMs' | 'seed' | 'timeZone'>) => Promise<void>;
  care: (action: CareAction) => Promise<ActOutcome>;
  setResting: (on: boolean) => Promise<void>;
  setNotificationHour: (hour: number | null) => Promise<void>;
  refresh: () => Promise<void>;
  deleteEverything: () => Promise<void>;
};

const GameContext = createContext<GameContextValue | null>(null);

const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const safeCount = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

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

/** Movement for the last 7 days up to today in the home time zone. Bad values count as 0. */
async function readMovement(game: GameState): Promise<Record<string, DayCounts>> {
  if (!movementSource) return {};
  const today = localDate(Date.now(), game.clock.homeTimeZone);
  try {
    const days = await movementSource.readDays(lastNDates(today, 7));
    return Object.fromEntries(
      days.map((d) => [
        d.date,
        {
          steps: safeCount(d.steps),
          exerciseMinutes: safeCount(d.exerciseMinutes),
          wheelchairPushes: safeCount(d.wheelchairPushes),
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
  const [unreadableSave, setUnreadableSave] = useState(false);
  const latest = useRef<GameState | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  // Bumped by Delete; a change queued before the delete is dropped instead of resurrecting it.
  const generation = useRef(0);

  /**
   * Every change to the game runs here, one at a time, against the latest state, so a slow
   * health read can never overwrite a meal tapped meanwhile.
   */
  const update = useCallback(
    <T,>(change: (current: GameState) => { state: GameState; result: T }): Promise<T | null> => {
      const gen = generation.current;
      const run = queue.current.then(async () => {
        const current = latest.current;
        if (!current || gen !== generation.current) return null;
        const { state, result } = change(current);
        if (state !== current) {
          latest.current = state;
          setGame(state);
          await saveGame(state);
        }
        return result;
      });
      queue.current = run.catch(() => undefined);
      return run;
    },
    [],
  );

  const refresh = useCallback(async () => {
    const snapshot = latest.current;
    if (!snapshot) return;
    setTrackingContext(snapshot);
    track('app_opened');
    try {
      const [movement, healthNow] = await Promise.all([readMovement(snapshot), readHealth()]);
      setHealth(healthNow);
      await update((current) => {
        // Credit yesterday's late steps before the day rolls over, so the new day sees the
        // real result (a goal day, zoomies, the weekly goal), then credit today.
        let next = syncMovement(current, movement, gameConfig);
        next = advanceToNow(next, Date.now(), gameConfig);
        next = syncMovement(next, movement, gameConfig);
        return { state: next, result: undefined };
      });
    } catch {
      // A failed refresh leaves the saved game untouched; the next foreground tries again.
    }
  }, [update]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await loadGame().catch(() => ({ kind: 'empty' }) as const);
      if (cancelled) return;
      if (result.kind === 'loaded') {
        latest.current = result.state;
        setGame(result.state);
        setStatus('ready');
        await refresh();
      } else {
        setUnreadableSave(result.kind === 'unreadable');
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
      await saveGame(adopted);
      setTrackingContext(adopted);
      track('app_installed');
      latest.current = adopted;
      setGame(adopted);
      setUnreadableSave(false);
      setStatus('ready');
      await refresh();
    },
    [refresh],
  );

  const care = useCallback<GameContextValue['care']>(
    async (action) => {
      const outcome = await update((current) => {
        // The app may have stayed open past midnight: start the new day before acting.
        const today = advanceToNow(current, Date.now(), gameConfig);
        const result = act(today, action, gameConfig);
        return { state: result.ok ? result.state : today, result };
      });
      if (outcome?.ok) track('care_action', { action: action.type });
      return outcome ?? { ok: false, reason: 'noGame' };
    },
    [update],
  );

  const setResting = useCallback(
    async (on: boolean) => {
      await update((current) => ({
        state: setRestMode(advanceToNow(current, Date.now(), gameConfig), on),
        result: undefined,
      }));
      track('rest_mode_toggled', { on });
    },
    [update],
  );

  const setNotificationHour = useCallback(
    async (hour: number | null) => {
      await update((current) => ({ state: setNotifyHour(current, hour), result: undefined }));
      track('notification_time_set', { slot: hour === null ? 'off' : String(hour) });
    },
    [update],
  );

  // Keep a week of good-news notifications scheduled; rebuild when anything they depend on changes.
  const lastDay = game?.clock.lastDay;
  const resting = game?.restMode;
  const hour = game ? notifyHourOf(game) : undefined;
  useEffect(() => {
    const current = latest.current;
    if (!current) return;
    setTrackingContext(current);
    rescheduleDaily(current).catch(() => undefined);
  }, [lastDay, resting, hour]);

  const deleteEverything = useCallback(async () => {
    generation.current += 1;
    await queue.current;
    await deleteAllData();
    latest.current = null;
    setGame(null);
    setUnreadableSave(false);
    setStatus('needs-adoption');
  }, []);

  return (
    <GameContext.Provider
      value={{
        status,
        game,
        health,
        unreadableSave,
        adoptPet,
        care,
        setResting,
        setNotificationHour,
        refresh,
        deleteEverything,
      }}
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
