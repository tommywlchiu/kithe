import type { IsoDate } from './movement';
import { mood, type Needs, type NeedsConfig, raiseNeed } from './needs';
import { balance, debit, type LedgerEntry } from './wallet';

export type CareAction =
  | { type: 'meal' }
  | { type: 'treat' }
  | { type: 'brushing' }
  | { type: 'buyToy'; toyId: string }
  | { type: 'play'; toyId: string }
  | { type: 'trainingSession'; trickId: string };

/** Built from @kithe/content (economy + items) by the caller; core never imports content. */
export type CareConfig = {
  needs: NeedsConfig;
  prices: { meal: number; treat: number; brushing: number; trainingSession: number };
  effects: { meal: number; treat: number; brushing: number; play: number };
  bondPerAction: number;
  treatDailyLimit: number;
  /** Sessions needed to learn each trick, by trick id. */
  tricks: Readonly<Record<string, number>>;
  toys: Readonly<Record<string, { price: number; wearDays: number }>>;
};

export type OwnedToy = { toyId: string; wearDaysLeft: number };

export type CareState = {
  today: IsoDate;
  needs: Needs;
  bond: number;
  ledger: readonly LedgerEntry[];
  treatsToday: number;
  toys: readonly OwnedToy[];
  trickProgress: Readonly<Record<string, number>>;
};

export type CareOutcome =
  | { ok: true; state: CareState; triggered: readonly 'treatsOverLimit'[] }
  | {
      ok: false;
      reason:
        | 'notEnoughPawprints'
        | 'unknownToy'
        | 'noUsableToy'
        | 'unknownTrick'
        | 'trickAlreadyLearned';
    };

/** Own keys only, so ids like "toString" can never resolve to a built-in. */
function toyFor(config: CareConfig, toyId: string) {
  return Object.hasOwn(config.toys, toyId) ? config.toys[toyId] : undefined;
}

type Refusal = Extract<CareOutcome, { ok: false }>['reason'];

/** Refusals that do not depend on money come first, so the reason shown is the real one. */
function refusalFor(state: CareState, action: CareAction, config: CareConfig): Refusal | null {
  switch (action.type) {
    case 'buyToy':
      return toyFor(config, action.toyId) ? null : 'unknownToy';
    case 'play':
      return state.toys.some((t) => t.toyId === action.toyId && t.wearDaysLeft > 0)
        ? null
        : 'noUsableToy';
    case 'trainingSession': {
      if (!Object.hasOwn(config.tricks, action.trickId)) return 'unknownTrick';
      return trickLearned(state, action.trickId, config) ? 'trickAlreadyLearned' : null;
    }
    default:
      return null;
  }
}

function priceOf(action: CareAction, config: CareConfig): number {
  switch (action.type) {
    case 'play':
      return 0;
    case 'buyToy':
      return toyFor(config, action.toyId)!.price;
    default:
      return config.prices[action.type];
  }
}

/**
 * One care action. Spending comes only from the Pawprint ledger, never money (invariant 1).
 * Each action adds bond unless the pup is mopey, so neglect pauses progress instead of
 * punishing. Needs cap at 100 and never drop below the floor. Vet visits arrive with life
 * events (T5), since a visit only makes sense when a checkup is due.
 */
export function applyCare(state: CareState, action: CareAction, config: CareConfig): CareOutcome {
  const refusal = refusalFor(state, action, config);
  if (refusal) return { ok: false, reason: refusal };
  const price = priceOf(action, config);
  if (price > balance(state.ledger)) return { ok: false, reason: 'notEnoughPawprints' };

  const floor = config.needs.floor;
  const needs = { ...state.needs };
  let { treatsToday, toys, trickProgress } = state;
  const triggered: 'treatsOverLimit'[] = [];

  switch (action.type) {
    case 'meal':
      needs.fullness = raiseNeed(needs.fullness, config.effects.meal, floor);
      break;
    case 'treat':
      needs.fullness = raiseNeed(needs.fullness, config.effects.treat, floor);
      treatsToday += 1;
      if (treatsToday === config.treatDailyLimit + 1) triggered.push('treatsOverLimit');
      break;
    case 'brushing':
      needs.cleanliness = raiseNeed(needs.cleanliness, config.effects.brushing, floor);
      break;
    case 'buyToy':
      toys = [
        ...toys,
        { toyId: action.toyId, wearDaysLeft: toyFor(config, action.toyId)!.wearDays },
      ];
      break;
    case 'play': {
      const index = toys.findIndex((t) => t.toyId === action.toyId && t.wearDaysLeft > 0);
      toys = toys.map((t, i) => (i === index ? { ...t, wearDaysLeft: t.wearDaysLeft - 1 } : t));
      needs.playfulness = raiseNeed(needs.playfulness, config.effects.play, floor);
      break;
    }
    case 'trainingSession':
      trickProgress = {
        ...trickProgress,
        [action.trickId]: (trickProgress[action.trickId] ?? 0) + 1,
      };
      break;
  }

  const wasMopey = mood(state.needs, config.needs) === 'mopey';
  const bond = state.bond + (wasMopey || action.type === 'buyToy' ? 0 : config.bondPerAction);
  const ledger =
    price > 0 ? [...state.ledger, debit(state.today, price, action.type)] : state.ledger;

  return {
    ok: true,
    state: { ...state, needs, bond, ledger, treatsToday, toys, trickProgress },
    triggered,
  };
}

export function trickLearned(state: CareState, trickId: string, config: CareConfig): boolean {
  const needed = Object.hasOwn(config.tricks, trickId) ? config.tricks[trickId]! : Infinity;
  return (state.trickProgress[trickId] ?? 0) >= needed;
}
