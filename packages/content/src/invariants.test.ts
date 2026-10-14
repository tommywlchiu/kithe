import { describe, expect, it } from 'vitest';

import rawEconomy from './data/economy.json';
import rawEvents from './data/events.json';
import rawItems from './data/items.json';
import { economy, economySchema, events, eventsSchema, items, itemsSchema } from './index';

type Loose = Record<string, unknown>;
type LooseEconomy = {
  care: Record<string, Loose>;
  cosmetics: Record<string, Loose>;
};
type LooseItems = { items: Record<string, Loose> };
type LooseEvents = { events: { id: string; reward: Loose | null }[] };

const clone = <T>(raw: unknown): T => JSON.parse(JSON.stringify(raw)) as T;
const cloneEconomy = () => clone<LooseEconomy>(rawEconomy);
const cloneItems = () => clone<LooseItems>(rawItems);

const forbiddenPriceKeys = ['priceStars', 'priceUsd'];

describe('invariant 1: care can never be bought', () => {
  it('prices every care entry and shop item in Pawprints and nothing else', () => {
    const entries = [...Object.entries(cloneEconomy().care), ...Object.entries(cloneItems().items)];
    expect(entries.length).toBeGreaterThan(0);
    for (const [id, item] of entries) {
      expect(item.pricePawprints, `${id}.pricePawprints`).toBeGreaterThan(0);
      for (const key of forbiddenPriceKeys) expect(item, id).not.toHaveProperty(key);
    }
  });

  it('rejects a care item that gains a Stars price', () => {
    const tampered = cloneEconomy();
    tampered.care.meal!.priceStars = 50;
    expect(() => economySchema.parse(tampered)).toThrow();
  });

  it('rejects a care item that gains a dollar price', () => {
    const tampered = cloneEconomy();
    tampered.care.treat!.priceUsd = 0.99;
    expect(() => economySchema.parse(tampered)).toThrow();
  });

  it.each(Object.keys(rawItems.items))(
    'rejects shop item %s gaining a Stars or dollar price',
    (id) => {
      for (const key of forbiddenPriceKeys) {
        const tampered = cloneItems();
        tampered.items[id]![key] = 1;
        expect(() => itemsSchema.parse(tampered), `${id}.${key}`).toThrow();
      }
    },
  );

  it('rejects a shop item without a Pawprint price', () => {
    const tampered = cloneItems();
    delete tampered.items.squeakyBall!.pricePawprints;
    expect(() => itemsSchema.parse(tampered)).toThrow();
  });

  it('keeps the training session price identical in economy and the shop', () => {
    expect(items.items.trainingSession?.pricePawprints).toBe(
      economy.care.trainingSession?.pricePawprints,
    );
  });

  it('rejects a cosmetic that gains a Pawprint price', () => {
    const tampered = cloneEconomy();
    tampered.cosmetics.sunHat = {
      kind: 'purchasable',
      name: 'Sun hat',
      priceStars: 1,
      slot: 'head',
    };
    expect(() => economySchema.parse(tampered)).not.toThrow();
    tampered.cosmetics.sunHat.pricePawprints = 10;
    expect(() => economySchema.parse(tampered)).toThrow();

    const granted = cloneEconomy();
    granted.cosmetics.foundingPupCollar!.pricePawprints = 10;
    expect(() => economySchema.parse(granted)).toThrow();
  });

  it('rejects a granted cosmetic that gains a Stars price', () => {
    const tampered = cloneEconomy();
    tampered.cosmetics.foundingPupCollar!.priceStars = 5;
    expect(() => economySchema.parse(tampered)).toThrow();
  });

  it('never lets an event reward grant currency', () => {
    for (const key of ['pawprints', 'stars', 'pricePawprints']) {
      const tampered = clone<LooseEvents>(rawEvents);
      const sock = tampered.events.find((e) => e.id === 'stoleSock')!;
      sock.reward = { ...sock.reward, [key]: 10 };
      expect(() => eventsSchema.parse(tampered), key).toThrow();
    }
    expect(events.events.length).toBe(5);
  });
});

describe('economy data', () => {
  it('parses and exposes the design-doc starting values', () => {
    expect(economy.earnings.atGoal).toBe(100);
    expect(economy.earnings.dailyCap).toBe(125);
    expect(economy.earnings.starterKit).toBe(100);
    expect(economy.needs.floor).toBe(25);
    expect(economy.needs.energyRestoredOvernight).toBe(100);
    expect(economy.care.meal?.pricePawprints).toBe(15);
    expect(economy.care.treat?.perDayLimit).toBe(3);
    expect(economy.careEffects).toEqual({
      meal: { fullness: 25 },
      treat: { fullness: 5 },
      brushing: { cleanliness: 40 },
      play: { playfulness: 35 },
    });
    expect(economy.bondPerCareAction).toBe(2);
    expect(economy.training.tricks.sit?.sessionsToLearn).toBe(5);
    expect(economy.growth).toEqual({
      adolescent: { days: 14, bond: 20 },
      adult: { days: 42, bond: 60 },
    });
  });

  it('grants the Founding Pup collar instead of selling it', () => {
    expect(economy.cosmetics.foundingPupCollar).toEqual({
      kind: 'granted',
      name: 'Founding Pup collar',
      grantedBy: 'founding-tester',
      slot: 'neck',
    });
  });

  it('has a care effect for every priced need-restoring action', () => {
    for (const id of ['meal', 'treat', 'brushing']) {
      expect(economy.care[id], id).toBeDefined();
      expect(economy.careEffects[id], id).toBeDefined();
    }
  });
});
