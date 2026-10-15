import { z } from 'zod';

import { idString } from './ids';

const needLevel = z.number().int().min(0).max(100);

export const petsSchema = z.strictObject({
  version: z.string().min(1),
  breeds: z
    .array(z.strictObject({ id: idString, name: z.string().min(1) }))
    .min(1)
    .refine((b) => new Set(b.map((x) => x.id)).size === b.length, {
      message: 'breed ids must be unique',
    }),
  traitsPerPet: z.number().int().min(1).max(3),
  adoptionNeeds: z.strictObject({
    fullness: needLevel,
    cleanliness: needLevel,
    playfulness: needLevel,
    energy: needLevel,
  }),
});

export type Pets = z.infer<typeof petsSchema>;
