import { z } from 'zod';

import { pawprintPrice } from './ids';

const pawprints = pawprintPrice;
const stars = z.number().int().positive();
const fraction = z.number().min(0).max(1);
const needLevel = z.number().int().min(0).max(100);
const daysOfWeek = z.number().int().min(0).max(7);
const positiveInt = z.number().int().positive();

// Strict shapes are the invariant: a care item carries a Pawprint price and nothing else,
// so a `priceStars` or `priceUsd` key on one fails validation instead of silently shipping.
export const careItemSchema = z.strictObject({
  name: z.string().min(1),
  pricePawprints: pawprints,
  perDayLimit: positiveInt.optional(),
});

const cosmeticSlot = z.enum(['head', 'neck', 'back']);

// Cosmetics are either bought with Stars or granted; neither shape accepts a Pawprint price.
export const cosmeticItemSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('purchasable'),
    name: z.string().min(1),
    priceStars: stars,
    slot: cosmeticSlot,
  }),
  z.strictObject({
    kind: z.literal('granted'),
    name: z.string().min(1),
    grantedBy: z.literal('founding-tester'),
    slot: cosmeticSlot,
  }),
]);

export const careEffectSchema = z
  .strictObject({
    fullness: needLevel.optional(),
    cleanliness: needLevel.optional(),
    playfulness: needLevel.optional(),
  })
  .refine((e) => Object.values(e).some((v) => v !== undefined && v > 0), {
    message: 'a care effect must raise at least one need',
  });

const growthThreshold = z.strictObject({
  days: positiveInt,
  bond: positiveInt,
});

export const economySchema = z.strictObject({
  version: z.string().min(1),
  earnings: z
    .strictObject({
      atGoal: pawprints,
      dailyCap: pawprints,
      starterKit: pawprints,
    })
    .refine((e) => e.dailyCap >= e.atGoal, {
      message: 'dailyCap must be at least atGoal',
    }),
  goal: z
    .strictObject({
      minSteps: positiveInt,
      maxSteps: positiveInt,
      minExerciseMinutes: positiveInt,
      maxExerciseMinutes: positiveInt,
      firstDayMultiplier: fraction,
      weeklyAdjustPct: fraction,
      raiseAfterDaysHit: daysOfWeek,
      lowerAtOrBelowDaysHit: daysOfWeek,
    })
    .refine((g) => g.maxSteps > g.minSteps && g.maxExerciseMinutes > g.minExerciseMinutes, {
      message: 'goal maxima must exceed minima',
    })
    .refine((g) => g.raiseAfterDaysHit > g.lowerAtOrBelowDaysHit, {
      message: 'raiseAfterDaysHit must exceed lowerAtOrBelowDaysHit',
    }),
  needs: z
    .strictObject({
      floor: needLevel,
      decayPerDay: z.strictObject({
        fullness: needLevel,
        cleanliness: needLevel,
        playfulness: needLevel,
      }),
      energyRestoredOvernight: needLevel,
      mood: z.strictObject({
        thrivingAt: needLevel,
        contentAt: needLevel,
      }),
    })
    .refine((n) => n.mood.thrivingAt > n.mood.contentAt && n.mood.contentAt > n.floor, {
      message: 'mood thresholds must be ordered thriving > content > floor',
    }),
  care: z.record(z.string(), careItemSchema),
  // Keyed by care action id: the care keys plus `play`, which is free with a toy.
  careEffects: z.record(z.string(), careEffectSchema),
  bondPerCareAction: positiveInt,
  training: z.strictObject({
    tricks: z.record(z.string(), z.strictObject({ sessionsToLearn: positiveInt })),
  }),
  growth: z
    .strictObject({
      adolescent: growthThreshold,
      adult: growthThreshold,
    })
    .refine((g) => g.adult.days > g.adolescent.days && g.adult.bond > g.adolescent.bond, {
      message: 'adult thresholds must exceed adolescent thresholds',
    }),
  cosmetics: z.record(z.string(), cosmeticItemSchema),
});

export type Economy = z.infer<typeof economySchema>;
export type CareItem = z.infer<typeof careItemSchema>;
export type CareEffect = z.infer<typeof careEffectSchema>;
export type CosmeticItem = z.infer<typeof cosmeticItemSchema>;
