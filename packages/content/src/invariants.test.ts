import { describe, expect, it } from 'vitest';

import rawEconomy from './data/economy.json';
import { economy, economySchema } from './index';

type LooseEconomy = {
  care: Record<string, Record<string, unknown>>;
  cosmetics: Record<string, Record<string, unknown>>;
};

const cloneRaw = (): LooseEconomy => JSON.parse(JSON.stringify(rawEconomy)) as LooseEconomy;

describe('invariant 1: care can never be bought', () => {
  it('prices every care item in Pawprints and nothing else', () => {
    const raw = cloneRaw();
    expect(Object.keys(raw.care).length).toBeGreaterThan(0);
    for (const [id, item] of Object.entries(raw.care)) {
      expect(item.pricePawprints, `${id}.pricePawprints`).toBeGreaterThan(0);
      expect(item, id).not.toHaveProperty('priceStars');
      expect(item, id).not.toHaveProperty('priceUsd');
    }
  });

  it('rejects a care item that gains a Stars price', () => {
    const tampered = cloneRaw();
    tampered.care.meal!.priceStars = 50;
    expect(() => economySchema.parse(tampered)).toThrow();
  });

  it('rejects a care item that gains a dollar price', () => {
    const tampered = cloneRaw();
    tampered.care.treat!.priceUsd = 0.99;
    expect(() => economySchema.parse(tampered)).toThrow();
  });

  it('rejects a cosmetic that gains a Pawprint price', () => {
    const tampered = cloneRaw();
    tampered.cosmetics.foundingCollar = {
      name: 'Founding Pup collar',
      priceStars: 1,
      slot: 'neck',
    };
    expect(() => economySchema.parse(tampered)).not.toThrow();
    tampered.cosmetics.foundingCollar.pricePawprints = 10;
    expect(() => economySchema.parse(tampered)).toThrow();
  });
});

describe('economy data', () => {
  it('parses and exposes the design-doc starting values', () => {
    expect(economy.earnings.atGoal).toBe(100);
    expect(economy.earnings.dailyCap).toBe(125);
    expect(economy.needs.floor).toBe(25);
    expect(economy.care.meal?.pricePawprints).toBe(15);
  });
});
