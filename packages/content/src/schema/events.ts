import { z } from 'zod';

import { eventIdSchema, idString } from './ids';

export const eventTriggerSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('onDay'), day: z.number().int().positive() }),
  z.strictObject({ type: z.literal('afterGoalBeat') }),
  // `chance` is the probability the event fires on any one eligible day; 0.14 is about weekly.
  z.strictObject({ type: z.literal('randomDaily'), chance: z.number().gt(0).max(1) }),
  // Fires when treats in one day exceed economy.care.treat.perDayLimit.
  z.strictObject({ type: z.literal('treatsOverLimit') }),
]);

// No Pawprint, Stars, or price key exists here: event rewards may grant bond, trick progress,
// or a memory, never currency (invariant 1).
export const eventRewardSchema = z
  .strictObject({
    bond: z.number().int().positive().optional(),
    trickProgress: z.number().int().positive().optional(),
    memory: idString.optional(),
  })
  .refine((r) => Object.values(r).some((v) => v !== undefined), {
    message: 'a reward must grant something; use null for no reward',
  });

const base = {
  id: eventIdSchema,
  name: z.string().min(1),
  trigger: eventTriggerSchema,
  // A care action id (economy.care key, `play`) or a shop item id; null when no action is needed.
  response: idString.nullable(),
  reward: eventRewardSchema.nullable(),
};

// "Negative" means the event counts toward the one-negative-event-per-7-days rule and is
// skipped in Rest Mode. Teething and upset tummy are mild discomforts. The first vet checkup is a
// routine milestone (it earns the health booklet), so it is not negative and never blocks
// teething. Zoomies and the stolen sock are pure fun. Negative events always
// resolve on their own (design doc: within 48 hours even if ignored).
export const lifeEventSchema = z.discriminatedUnion('negative', [
  z.strictObject({
    ...base,
    negative: z.literal(true),
    resolvesWithinHours: z.number().int().positive().max(48),
  }),
  z.strictObject({
    ...base,
    negative: z.literal(false),
  }),
]);

export const eventsSchema = z.strictObject({
  version: z.string().min(1),
  events: z.array(lifeEventSchema).refine((es) => new Set(es.map((e) => e.id)).size === es.length, {
    message: 'event ids must be unique',
  }),
});

export type EventTrigger = z.infer<typeof eventTriggerSchema>;
export type EventReward = z.infer<typeof eventRewardSchema>;
export type LifeEvent = z.infer<typeof lifeEventSchema>;
export type Events = z.infer<typeof eventsSchema>;
