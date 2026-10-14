import type { IsoDate } from './movement';
import { mood, type Needs, type NeedsConfig, raiseNeed } from './needs';
import { balance, debit, type LedgerEntry } from './wallet';

export type CareAction =
  | { type: 'meal' }
  | { type: 'treat' }
  | { type: 'brushing' }
  | { type: 'buyToy'; toyId: string }
  | { type: 'play'; toyId: string }
  | { type: 'trainingSession'; trickId: string }
  | { type: 'vetVisit' };

/** Built from @kithe/content (economy + items) by the caller; core never imports content. */
export type CareConfig = {
  needs: NeedsConfig;
  prices: {
    meal: number;
    treat: number;
    brushing: number;
    trainingSession: number;
    vetVisit: number;
  };
  effects: { meal: number; treat: number; brushing: number; play: number };
  bondPerAction: number;
  treatDailyLimit: number;
  sessionsPerTrick: number;
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
  | { ok: true; state: CareState; triggered: readonly 'upsetTummy'[] }
  | {
      ok: false;
      reason: 'notEnoughPawprints' | 'unknownToy' | 'noUsableToy' | 'trickAlreadyLearned';
    };

function priceOf(action: CareAction, config: CareConfig): number {
  switch (action.type) {
    case 'play':
      return 0;
    case 'buyToy':
      return config.toys[action.toyId]?.price ?? Number.NaN;
    default:
      return config.prices[action.type];
  }
}

/**
 * One care action. Spending comes only from the Pawprint ledger, never money (invariant 1).
 * Each action adds bond unless the pup is mopey, so neglect pauses progress instead of
 * punishing. Needs cap at 100 and never drop below the floor.
 */
export function applyCare(state: CareState, action: CareAction, config: CareConfig): CareOutcome {
  const price = priceOf(action, config);
  if (Number.isNaN(price)) return { ok: false, reason: 'unknownToy' };
  if (price > balance(state.ledger)) return { ok: false, reason: 'notEnoughPawprints' };

  const floor = config.needs.floor;
  const needs = { ...state.needs };
  let { treatsToday, toys, trickProgress } = state;
  const triggered: 'upsetTummy'[] = [];

  switch (action.type) {
    case 'meal':
      needs.fullness = raiseNeed(needs.fullness, config.effects.meal, floor);
      break;
    case 'treat':
      needs.fullness = raiseNeed(needs.fullness, config.effects.treat, floor);
      treatsToday += 1;
      if (treatsToday === config.treatDailyLimit + 1) triggered.push('upsetTummy');
      break;
    case 'brushing':
      needs.cleanliness = raiseNeed(needs.cleanliness, config.effects.brushing, floor);
      break;
    case 'buyToy':
      toys = [...toys, { toyId: action.toyId, wearDaysLeft: config.toys[action.toyId]!.wearDays }];
      break;
    case 'play': {
      const index = toys.findIndex((t) => t.toyId === action.toyId && t.wearDaysLeft > 0);
      if (index === -1) return { ok: false, reason: 'noUsableToy' };
      toys = toys.map((t, i) => (i === index ? { ...t, wearDaysLeft: t.wearDaysLeft - 1 } : t));
      needs.playfulness = raiseNeed(needs.playfulness, config.effects.play, floor);
      break;
    }
    case 'trainingSession': {
      const done = trickProgress[action.trickId] ?? 0;
      if (done >= config.sessionsPerTrick) return { ok: false, reason: 'trickAlreadyLearned' };
      trickProgress = { ...trickProgress, [action.trickId]: done + 1 };
      break;
    }
    case 'vetVisit':
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
  return (state.trickProgress[trickId] ?? 0) >= config.sessionsPerTrick;
}
