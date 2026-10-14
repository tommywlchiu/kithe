import rawBannedPhrases from './data/bannedPhrases.json';
import rawCopy from './data/copy.json';
import rawDiary from './data/diary.json';
import rawEconomy from './data/economy.json';
import rawEvents from './data/events.json';
import rawItems from './data/items.json';
import { bannedPhrasesSchema, copySchema } from './schema/copy';
import { diarySchema } from './schema/diary';
import { economySchema } from './schema/economy';
import { eventsSchema } from './schema/events';
import { itemsSchema } from './schema/items';

export {
  careEffectSchema,
  careItemSchema,
  cosmeticItemSchema,
  economySchema,
} from './schema/economy';
export type { CareEffect, CareItem, CosmeticItem, Economy } from './schema/economy';
export {
  eventIdSchema,
  eventIds,
  idString,
  pawprintPrice,
  traitIdSchema,
  traitIds,
} from './schema/ids';
export type { EventId, TraitId } from './schema/ids';
export { itemCategories, itemCategorySchema, itemsSchema, shopItemSchema } from './schema/items';
export type { ItemCategory, Items, ShopItem } from './schema/items';
export {
  eventRewardSchema,
  eventTriggerSchema,
  eventsSchema,
  lifeEventSchema,
} from './schema/events';
export type { EventReward, EventTrigger, Events, LifeEvent } from './schema/events';
export {
  diaryContexts,
  diaryLineSchema,
  diarySchema,
  diaryTagSchema,
  diaryTags,
  templateText,
} from './schema/diary';
export type { Diary, DiaryLine, DiaryTag } from './schema/diary';
export { bannedPhrasesSchema, copyLineSchema, copySchema } from './schema/copy';
export type { BannedPhrases, Copy, CopyLine } from './schema/copy';
export { compileBannedPhrases, findBannedPhrases } from './bannedPhrases';

export const economy = economySchema.parse(rawEconomy);
export const items = itemsSchema.parse(rawItems);
export const events = eventsSchema.parse(rawEvents);
export const diary = diarySchema.parse(rawDiary);
export const copy = copySchema.parse(rawCopy);
export const bannedPhrases = bannedPhrasesSchema.parse(rawBannedPhrases);
