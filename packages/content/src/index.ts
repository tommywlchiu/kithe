import rawEconomy from './data/economy.json';
import { economySchema } from './schema/economy';

export { careItemSchema, cosmeticItemSchema, economySchema } from './schema/economy';
export type { CareItem, CosmeticItem, Economy } from './schema/economy';

export const economy = economySchema.parse(rawEconomy);
