import { economy, events, items } from '@kithe/content';
import type {
  CareConfig,
  EarningsConfig,
  EventDef,
  GoalConfig,
  GrowthConfig,
  NeedsConfig,
} from '@kithe/core';

// The one place content data meets core rules. Core never imports content, so if a schema
// and a rule drift apart, it fails to typecheck or throws here instead of misbehaving.

function price(id: string): number {
  const fromCare = economy.care[id]?.pricePawprints;
  const fromShop = items.items[id]?.pricePawprints;
  const value = fromCare ?? fromShop;
  if (value === undefined) throw new Error(`content has no price for "${id}"`);
  return value;
}

function sessionsToLearn(trickId: string): number {
  const trick = economy.training.tricks[trickId];
  if (!trick) throw new Error(`content has no trick "${trickId}"`);
  return trick.sessionsToLearn;
}

export const earningsConfig: EarningsConfig = economy.earnings;
export const goalConfig: GoalConfig = economy.goal;
export const growthConfig: GrowthConfig = economy.growth;
export const needsConfig: NeedsConfig = economy.needs;

const treatLimit = economy.care.treat?.perDayLimit;
if (treatLimit === undefined) throw new Error('content has no treat perDayLimit');

export const careConfig: CareConfig = {
  needs: needsConfig,
  prices: {
    meal: price('meal'),
    treat: price('treat'),
    brushing: price('brushing'),
    trainingSession: price('trainingSession'),
  },
  effects: {
    meal: economy.careEffects.meal.fullness,
    treat: economy.careEffects.treat.fullness,
    brushing: economy.careEffects.brushing.cleanliness,
    play: economy.careEffects.play.playfulness,
  },
  bondPerAction: economy.bondPerCareAction,
  treatDailyLimit: treatLimit,
  sessionsPerTrick: sessionsToLearn('sit'),
  toys: Object.fromEntries(
    Object.entries(items.items).flatMap(([id, item]) =>
      item.category === 'toy'
        ? [[id, { price: item.pricePawprints, wearDays: item.wearDays }]]
        : [],
    ),
  ),
};

export const eventDefs: EventDef[] = events.events;
