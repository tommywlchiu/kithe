import { z } from 'zod';

export const traitIds = [
  'playful',
  'lazy',
  'curious',
  'dramatic',
  'cuddly',
  'foodie',
  'brave',
  'shy',
] as const;

export const eventIds = [
  'firstVetCheckup',
  'teething',
  'zoomies',
  'stoleSock',
  'upsetTummy',
] as const;

export const traitIdSchema = z.enum(traitIds);
export const eventIdSchema = z.enum(eventIds);

export type TraitId = z.infer<typeof traitIdSchema>;
export type EventId = z.infer<typeof eventIdSchema>;

export const pawprintPrice = z.number().int().positive();
export const idString = z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'ids are camelCase');
