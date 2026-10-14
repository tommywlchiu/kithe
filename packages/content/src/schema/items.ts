import { z } from 'zod';

import { idString, pawprintPrice } from './ids';

export const itemCategories = ['care', 'food', 'toy', 'training', 'vet'] as const;
export const itemCategorySchema = z.enum(itemCategories);

const base = {
  name: z.string().min(1),
  pricePawprints: pawprintPrice,
};

// Every shop item is a Pawprint sink (invariant 1). Strict shapes reject any Stars or dollar
// price key. Only toys wear out, so only toys carry wearDays.
export const shopItemSchema = z.discriminatedUnion('category', [
  z.strictObject({
    ...base,
    category: z.literal('toy'),
    wearDays: z.number().int().positive(),
  }),
  z.strictObject({
    ...base,
    category: z.enum(['care', 'food', 'training', 'vet']),
  }),
]);

export const itemsSchema = z.strictObject({
  version: z.string().min(1),
  items: z.record(idString, shopItemSchema),
});

export type ItemCategory = z.infer<typeof itemCategorySchema>;
export type ShopItem = z.infer<typeof shopItemSchema>;
export type Items = z.infer<typeof itemsSchema>;
