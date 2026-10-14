import { z } from 'zod';

import { eventIds, idString, traitIds } from './ids';

export const diaryContexts = [
  'goalHit',
  'goalMissed',
  'cozyWeek',
  'trickProgress',
  'firstDay',
  'restMode',
  'growth',
] as const;

export const diaryTags = [...traitIds, ...eventIds, ...diaryContexts] as const;
export const diaryTagSchema = z.enum(diaryTags);

// `{name}` (the pup's name) is the only placeholder a template may use.
export const templateText = z
  .string()
  .min(1)
  .refine((t) => (t.match(/\{[^}]*\}/g) ?? []).every((p) => p === '{name}'), {
    message: 'only the {name} placeholder is allowed',
  })
  .refine((t) => !/[{}]/.test(t.replaceAll('{name}', '')), {
    message: 'unclosed or stray brace; the only placeholder is {name}',
  });

export const diaryLineSchema = z.strictObject({
  id: idString,
  text: templateText,
  tags: z.array(diaryTagSchema).min(1),
});

export const diarySchema = z.strictObject({
  version: z.string().min(1),
  lines: z.array(diaryLineSchema).refine((ls) => new Set(ls.map((l) => l.id)).size === ls.length, {
    message: 'diary line ids must be unique',
  }),
});

export type DiaryTag = z.infer<typeof diaryTagSchema>;
export type DiaryLine = z.infer<typeof diaryLineSchema>;
export type Diary = z.infer<typeof diarySchema>;
