import { z } from 'zod';

const pawprints = z.number().int().positive();
const stars = z.number().int().positive();
const fraction = z.number().min(0).max(1);
const needLevel = z.number().int().min(0).max(100);
const daysOfWeek = z.number().int().min(0).max(7);

// Strict shapes are the invariant: a care item carries a Pawprint price and nothing else,
// so a `priceStars` or `priceUsd` key on one fails validation instead of silently shipping.
export const careItemSchema = z.strictObject({
  name: z.string().min(1),
  pricePawprints: pawprints,
  perDayLimit: z.number().int().positive().optional(),
});

export const cosmeticItemSchema = z.strictObject({
  name: z.string().min(1),
  priceStars: stars,
  slot: z.enum(['head', 'neck', 'back']),
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
      minSteps: z.number().int().positive(),
      maxSteps: z.number().int().positive(),
      minExerciseMinutes: z.number().int().positive(),
      maxExerciseMinutes: z.number().int().positive(),
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
      mood: z.strictObject({
        thrivingAt: needLevel,
        contentAt: needLevel,
      }),
    })
    .refine((n) => n.mood.thrivingAt > n.mood.contentAt && n.mood.contentAt > n.floor, {
      message: 'mood thresholds must be ordered thriving > content > floor',
    }),
  care: z.record(z.string(), careItemSchema),
  cosmetics: z.record(z.string(), cosmeticItemSchema),
});

export type Economy = z.infer<typeof economySchema>;
export type CareItem = z.infer<typeof careItemSchema>;
export type CosmeticItem = z.infer<typeof cosmeticItemSchema>;
