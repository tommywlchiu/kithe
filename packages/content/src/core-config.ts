import { diary, economy, events, items, pets } from './parsed';
import { traitIds } from './schema/ids';
import type {
  CareConfig,
  EventReward,
  GameConfig,
  DiaryLine,
  EarningsConfig,
  EventDef,
  GoalConfig,
  GrowthConfig,
  NeedsConfig,
} from '@kithe/core';

// The one place content data becomes core rule config, shared by the app and the economy sim.
// Core never imports content at runtime (only these types flow the other way), so if a schema
// and a rule drift apart this file fails to typecheck or throws at load instead of misbehaving.

function price(id: string): number {
  const fromCare = economy.care[id]?.pricePawprints;
  const fromShop = items.items[id]?.pricePawprints;
  const value = fromCare ?? fromShop;
  if (value === undefined) throw new Error(`content has no price for "${id}"`);
  return value;
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
  tricks: Object.fromEntries(
    Object.entries(economy.training.tricks).map(([id, t]) => [id, t.sessionsToLearn]),
  ),
  toys: Object.fromEntries(
    Object.entries(items.items).flatMap(([id, item]) =>
      item.category === 'toy'
        ? [[id, { price: item.pricePawprints, wearDays: item.wearDays }]]
        : [],
    ),
  ),
};

export const eventDefs: EventDef[] = events.events;

export const starterKitPawprints: number = economy.earnings.starterKit;
export const traitTags: readonly string[] = traitIds;
export const diaryLines: readonly DiaryLine[] = diary.lines;

export const gameConfig: GameConfig = {
  earnings: earningsConfig,
  goal: goalConfig,
  growth: growthConfig,
  care: careConfig,
  events: eventDefs,
  rewards: Object.fromEntries(
    events.events.map((e): [string, EventReward] => [e.id, e.reward ?? null]),
  ),
  diary: diaryLines,
  traitTags,
  traitsPerPet: pets.traitsPerPet,
  starterKit: starterKitPawprints,
  adoptionNeeds: pets.adoptionNeeds,
};

export const breeds = pets.breeds;
