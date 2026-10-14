import { z } from 'zod';

import { templateText } from './diary';
import { idString } from './ids';

export const copyLineSchema = z.strictObject({
  id: idString,
  text: templateText,
});

export const copySchema = z.strictObject({
  version: z.string().min(1),
  notifications: z.strictObject({
    // One good-news line per day, chosen from this pool.
    daily: z
      .array(copyLineSchema)
      .min(10)
      .refine((ls) => new Set(ls.map((l) => l.id)).size === ls.length, {
        message: 'notification ids must be unique',
      }),
    // Sent the morning after adoption.
    dayOne: copyLineSchema,
  }),
});

export const bannedPhrasesSchema = z.strictObject({
  version: z.string().min(1),
  phrases: z
    .array(
      z
        .string()
        .min(1)
        .regex(/^[a-z]+( [a-z]+)*$/, 'phrases are lowercase words separated by single spaces'),
    )
    .min(1)
    .refine((ps) => new Set(ps).size === ps.length, { message: 'phrases must be unique' }),
});

export type CopyLine = z.infer<typeof copyLineSchema>;
export type Copy = z.infer<typeof copySchema>;
export type BannedPhrases = z.infer<typeof bannedPhrasesSchema>;
