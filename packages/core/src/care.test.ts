import { describe, expect, expectTypeOf, it } from 'vitest';

import { applyCare, type CareConfig, type CareState, trickLearned } from './care';
import { decayNeeds, mood, type Needs, type NeedsConfig } from './needs';
import { balance, credit, debit, type LedgerEntry } from './wallet';

// Spec values (docs/specs/phase-0-concept-art-prototype.md, Core logic).
const NEEDS: NeedsConfig = {
  floor: 25,
  decayPerDay: { fullness: 50, cleanliness: 20, playfulness: 35 },
  mood: { thrivingAt: 70, contentAt: 40 },
};
const CARE: CareConfig = {
  needs: NEEDS,
  prices: { meal: 15, treat: 5, brushing: 10, trainingSession: 60 },
  effects: { meal: 25, treat: 5, brushing: 40, play: 35 },
  bondPerAction: 2,
  treatDailyLimit: 3,
  sessionsPerTrick: 5,
  toys: { ball: { price: 40, wearDays: 14 } },
};

const full: Needs = { fullness: 80, cleanliness: 80, playfulness: 80, energy: 100 };
const state = (over: Partial<CareState> = {}): CareState => ({
  today: '2026-10-14',
  needs: full,
  bond: 0,
  ledger: [credit('2026-10-14', 100, { kind: 'starterKit' })],
  treatsToday: 0,
  toys: [],
  trickProgress: {},
  ...over,
});
const ok = (outcome: ReturnType<typeof applyCare>) => {
  if (!outcome.ok) throw new Error(`expected ok, got ${outcome.reason}`);
  return outcome;
};

describe('decayNeeds', () => {
  it('decays per day and refills energy overnight', () => {
    expect(decayNeeds({ ...full, energy: 30 }, 1, false, NEEDS)).toEqual({
      fullness: 30,
      cleanliness: 60,
      playfulness: 45,
      energy: 100,
    });
  });

  it('never drops below the safety floor, however long the gap', () => {
    expect(decayNeeds(full, 365, false, NEEDS)).toEqual({
      fullness: 25,
      cleanliness: 25,
      playfulness: 25,
      energy: 100,
    });
  });

  it('freezes everything in Rest Mode', () => {
    const tired = { ...full, energy: 10 };
    expect(decayNeeds(tired, 30, true, NEEDS)).toEqual(tired);
  });

  it('rejects partial or negative days', () => {
    expect(() => decayNeeds(full, 0.5, false, NEEDS)).toThrow(RangeError);
    expect(() => decayNeeds(full, -1, false, NEEDS)).toThrow(RangeError);
  });
});

describe('mood', () => {
  it.each([
    [{ fullness: 70, cleanliness: 70, playfulness: 70 }, 'thriving'],
    [{ fullness: 69, cleanliness: 70, playfulness: 70 }, 'content'],
    [{ fullness: 40, cleanliness: 40, playfulness: 40 }, 'content'],
    [{ fullness: 25, cleanliness: 25, playfulness: 25 }, 'mopey'],
  ])('%o is %s', (n, expected) => {
    expect(mood({ ...n, energy: 100 }, NEEDS)).toBe(expected);
  });

  it('ignores energy', () => {
    expect(mood({ ...full, energy: 0 }, NEEDS)).toBe('thriving');
  });
});

describe('wallet', () => {
  it('derives the balance from the ledger', () => {
    const ledger: LedgerEntry[] = [
      credit('2026-10-14', 100, { kind: 'starterKit' }),
      credit('2026-10-14', 75, { kind: 'movement' }),
      debit('2026-10-14', 15, 'meal'),
    ];
    expect(balance(ledger)).toBe(160);
  });

  it('takes direction from the reason, so a malformed entry cannot mint Pawprints', () => {
    const forged: LedgerEntry[] = [
      { date: '2026-10-14', amount: 500, reason: { kind: 'care', action: 'meal' } },
      { date: '2026-10-14', amount: -100, reason: { kind: 'movement' } },
    ];
    expect(balance(forged)).toBe(-400);
  });

  it('rejects fractional or negative amounts', () => {
    expect(() => credit('2026-10-14', 1.5, { kind: 'movement' })).toThrow(RangeError);
    expect(() => debit('2026-10-14', 0, 'meal')).toThrow(RangeError);
  });

  it('has no way to credit Pawprints from money (invariant 1)', () => {
    type Kinds = Parameters<typeof credit>[2]['kind'];
    expectTypeOf<Kinds>().toEqualTypeOf<'movement' | 'starterKit' | 'eventReward'>();
  });
});

describe('applyCare', () => {
  it('feeds, charges Pawprints, and adds bond', () => {
    const out = ok(applyCare(state({ needs: { ...full, fullness: 50 } }), { type: 'meal' }, CARE));
    expect(out.state.needs.fullness).toBe(75);
    expect(balance(out.state.ledger)).toBe(85);
    expect(out.state.bond).toBe(2);
  });

  it('caps needs at 100', () => {
    const out = ok(applyCare(state(), { type: 'brushing' }, CARE));
    expect(out.state.needs.cleanliness).toBe(100);
  });

  it('refuses when Pawprints run out, and never goes negative', () => {
    const broke = state({ ledger: [credit('2026-10-14', 10, { kind: 'movement' })] });
    expect(applyCare(broke, { type: 'meal' }, CARE)).toEqual({
      ok: false,
      reason: 'notEnoughPawprints',
    });
  });

  it('triggers upset tummy on the 4th treat of the day, once', () => {
    let s = state();
    const triggered: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const out = ok(applyCare(s, { type: 'treat' }, CARE));
      triggered.push(...out.triggered);
      s = out.state;
    }
    expect(triggered).toEqual(['upsetTummy']);
    expect(s.treatsToday).toBe(5);
  });

  it('buys a toy, plays with it, and wears it down by one day per play', () => {
    const bought = ok(applyCare(state(), { type: 'buyToy', toyId: 'ball' }, CARE));
    expect(balance(bought.state.ledger)).toBe(60);
    expect(bought.state.bond).toBe(0);
    const played = ok(
      applyCare(
        { ...bought.state, needs: { ...full, playfulness: 30 } },
        { type: 'play', toyId: 'ball' },
        CARE,
      ),
    );
    expect(played.state.needs.playfulness).toBe(65);
    expect(played.state.toys).toEqual([{ toyId: 'ball', wearDaysLeft: 13 }]);
    expect(balance(played.state.ledger)).toBe(60);
  });

  it('refuses play without a usable toy, and unknown toys', () => {
    expect(applyCare(state(), { type: 'play', toyId: 'ball' }, CARE)).toEqual({
      ok: false,
      reason: 'noUsableToy',
    });
    const worn = state({ toys: [{ toyId: 'ball', wearDaysLeft: 0 }] });
    expect(applyCare(worn, { type: 'play', toyId: 'ball' }, CARE)).toEqual({
      ok: false,
      reason: 'noUsableToy',
    });
    expect(applyCare(state(), { type: 'buyToy', toyId: 'rocket' }, CARE)).toEqual({
      ok: false,
      reason: 'unknownToy',
    });
  });

  it('learns a trick after the configured number of sessions, then stops charging', () => {
    let s = state({ ledger: [credit('2026-10-14', 1000, { kind: 'movement' })] });
    for (let i = 0; i < 5; i += 1)
      s = ok(applyCare(s, { type: 'trainingSession', trickId: 'sit' }, CARE)).state;
    expect(trickLearned(s, 'sit', CARE)).toBe(true);
    expect(balance(s.ledger)).toBe(700);
    expect(applyCare(s, { type: 'trainingSession', trickId: 'sit' }, CARE)).toEqual({
      ok: false,
      reason: 'trickAlreadyLearned',
    });
  });

  it('adds no bond while mopey, but care still lifts the pup', () => {
    const mopey = state({ needs: { fullness: 25, cleanliness: 25, playfulness: 25, energy: 100 } });
    const out = ok(applyCare(mopey, { type: 'meal' }, CARE));
    expect(out.state.bond).toBe(0);
    expect(out.state.needs.fullness).toBe(50);
  });

  it('recovers a mopey pup to content after one goal day of basic care (acceptance 5)', () => {
    let s = state({
      needs: { fullness: 25, cleanliness: 25, playfulness: 25, energy: 100 },
      ledger: [credit('2026-10-14', 100, { kind: 'movement' })],
    });
    for (const action of [{ type: 'meal' }, { type: 'meal' }, { type: 'brushing' }] as const) {
      s = ok(applyCare(s, action, CARE)).state;
    }
    expect(mood(s.needs, NEEDS)).toBe('content');
    expect(balance(s.ledger)).toBe(60);
  });

  it('never resolves built-in object keys as toys', () => {
    expect(applyCare(state(), { type: 'buyToy', toyId: 'toString' }, CARE)).toEqual({
      ok: false,
      reason: 'unknownToy',
    });
  });

  it('reports the real refusal before the money check', () => {
    const learnedButBroke = state({
      trickProgress: { sit: 5 },
      ledger: [credit('2026-10-14', 10, { kind: 'movement' })],
    });
    expect(applyCare(learnedButBroke, { type: 'trainingSession', trickId: 'sit' }, CARE)).toEqual({
      ok: false,
      reason: 'trickAlreadyLearned',
    });
  });

  it('has no death, starvation, or neglect-illness state (invariant 2)', () => {
    expectTypeOf<keyof Needs>().toEqualTypeOf<
      'fullness' | 'cleanliness' | 'playfulness' | 'energy'
    >();
    expectTypeOf<keyof CareState>().toEqualTypeOf<
      'today' | 'needs' | 'bond' | 'ledger' | 'treatsToday' | 'toys' | 'trickProgress'
    >();
  });
});
