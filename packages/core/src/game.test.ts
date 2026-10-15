import { describe, expect, it } from 'vitest';

import {
  act,
  adopt,
  advanceToNow,
  type GameConfig,
  type GameState,
  setRestMode,
  syncMovement,
  view,
} from './game';
import { balance } from './wallet';

const CONFIG: GameConfig = {
  earnings: { atGoal: 100, dailyCap: 125 },
  goal: {
    minSteps: 2000,
    maxSteps: 10000,
    minExerciseMinutes: 15,
    maxExerciseMinutes: 60,
    firstDayMultiplier: 0.5,
    weeklyAdjustPct: 0.1,
    raiseAfterDaysHit: 5,
    lowerAtOrBelowDaysHit: 1,
  },
  growth: { adolescent: { days: 14, bond: 20 }, adult: { days: 42, bond: 60 } },
  care: {
    needs: {
      floor: 25,
      decayPerDay: { fullness: 50, cleanliness: 20, playfulness: 35 },
      mood: { thrivingAt: 70, contentAt: 40 },
    },
    prices: { meal: 15, treat: 5, brushing: 10, trainingSession: 60 },
    effects: { meal: 25, treat: 5, brushing: 40, play: 35 },
    bondPerAction: 2,
    treatDailyLimit: 3,
    tricks: { sit: 5 },
    toys: { ball: { price: 40, wearDays: 14 } },
  },
  events: [
    { id: 'teething', negative: true, trigger: { type: 'onDay', day: 2 } },
    { id: 'upsetTummy', negative: true, trigger: { type: 'treatsOverLimit' } },
  ],
  rewards: { teething: { trickProgress: 1 }, upsetTummy: null },
  diary: [
    { id: 'first', text: '{name} slept in the new room.', tags: ['firstDay'] },
    { id: 'teeth', text: 'My teeth feel funny.', tags: ['teething'] },
    { id: 'walk', text: 'A good walk today.', tags: ['goalHit'] },
    { id: 'quiet', text: 'A quiet day by the window.', tags: ['goalMissed'] },
    { id: 'nap', text: 'A long cozy nap.', tags: ['restMode'] },
    { id: 'play', text: 'I chased the rope.', tags: ['playful'] },
    { id: 'curl', text: 'I curled up on the rug.', tags: ['cuddly'] },
  ],
  traitTags: ['playful', 'cuddly', 'lazy'],
  traitsPerPet: 2,
  starterKit: 100,
  adoptionNeeds: { fullness: 80, cleanliness: 80, playfulness: 80, energy: 100 },
};

const TZ = 'America/Los_Angeles';
// Noon in Los Angeles on the given local date.
const at = (date: string) => Date.parse(`${date}T19:00:00Z`);
const start = (): GameState =>
  adopt(
    {
      name: 'Biscuit',
      breed: 'beagle',
      timeZone: TZ,
      nowMs: at('2026-10-14'),
      seed: 7,
      startingGoal: { steps: 6000, exerciseMinutes: 30 },
    },
    CONFIG,
  );
const steps = (n: number) => ({ steps: n, exerciseMinutes: 0, wheelchairPushes: 0 });

describe('adopt', () => {
  it('starts with the starter kit, two distinct traits, an easy first day, and a diary line', () => {
    const s = start();
    expect(balance(s.care.ledger)).toBe(100);
    expect(new Set(s.pet.traits).size).toBe(2);
    expect(s.days).toEqual([
      {
        date: '2026-10-14',
        goal: { steps: 3000, exerciseMinutes: 15 },
        progress: 0,
        earned: 0,
        events: [],
      },
    ]);
    expect(s.diary).toEqual([
      { date: '2026-10-14', lineId: 'first', text: 'Biscuit slept in the new room.' },
    ]);
    expect(view(s, CONFIG)).toMatchObject({ mood: 'thriving', stage: 'puppy', art: 'thriving' });
  });
});

describe('syncMovement', () => {
  it('credits Pawprints for the day against that day goal, and only tops up', () => {
    let s = syncMovement(start(), { '2026-10-14': steps(3000) }, CONFIG);
    expect(balance(s.care.ledger)).toBe(200);
    s = syncMovement(s, { '2026-10-14': steps(4500) }, CONFIG);
    expect(balance(s.care.ledger)).toBe(212);
    s = syncMovement(s, { '2026-10-14': steps(1000) }, CONFIG);
    expect(balance(s.care.ledger)).toBe(212);
    expect(s.days[0]!.progress).toBe(1.5);
  });
});

describe('advanceToNow', () => {
  it('does nothing later on the same day', () => {
    const s = start();
    expect(advanceToNow(s, at('2026-10-14') + 3_600_000, CONFIG)).toBe(s);
  });

  it('starts each new day: decay, a day together, events, and a diary line', () => {
    const s = advanceToNow(start(), at('2026-10-15'), CONFIG);
    expect(s.daysTogether).toBe(1);
    expect(s.care.needs.fullness).toBe(30);
    expect(s.days.at(-1)!.events).toEqual(['teething']);
    expect(s.care.trickProgress).toEqual({ sit: 1 });
    expect(s.diary.at(-1)!.lineId).toBe('teeth');
  });

  it('catches up several days at once without double counting', () => {
    const s = advanceToNow(start(), at('2026-10-18'), CONFIG);
    expect(s.daysTogether).toBe(4);
    expect(s.days.map((d) => d.date)).toEqual([
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
    ]);
    expect(s.care.needs).toMatchObject({ fullness: 25, cleanliness: 25, playfulness: 25 });
  });

  it('counts long absences as days together but only plays the last 7', () => {
    const s = advanceToNow(start(), at('2026-11-13'), CONFIG);
    expect(s.daysTogether).toBe(30);
    expect(s.diary.length).toBe(8);
  });

  it('freezes needs, growth, and events in Rest Mode', () => {
    const resting = setRestMode(start(), true);
    const s = advanceToNow(resting, at('2026-10-20'), CONFIG);
    expect(s.care.needs).toEqual(resting.care.needs);
    expect(s.daysTogether).toBe(0);
    expect(s.days.flatMap((d) => d.events)).toEqual([]);
    expect(view(s, CONFIG).art).toBe('sleeping');
    expect(s.diary.at(-1)!.lineId).toBe('nap');
  });

  it('raises the goal after a week with 5+ goal days', () => {
    let s = start();
    for (let d = 14; d <= 20; d += 1) {
      const date = `2026-10-${d}`;
      s = advanceToNow(s, at(date), CONFIG);
      s = syncMovement(s, { [date]: steps(7000) }, CONFIG);
    }
    s = advanceToNow(s, at('2026-10-21'), CONFIG);
    expect(s.goal).toEqual({ steps: 6600, exerciseMinutes: 33 });
  });

  it('tags the diary with yesterday goal result', () => {
    let s = syncMovement(start(), { '2026-10-14': steps(3000) }, CONFIG);
    s = advanceToNow(s, at('2026-10-15'), CONFIG);
    s = advanceToNow(s, at('2026-10-16'), CONFIG);
    expect(s.diary.at(-1)!.lineId).toBe('quiet');
  });
});

describe('act', () => {
  it('applies care and reports refusals', () => {
    const fed = act(start(), { type: 'meal' }, CONFIG);
    expect(fed.ok && balance(fed.state.care.ledger)).toBe(85);
    expect(act(start(), { type: 'play', toyId: 'ball' }, CONFIG)).toEqual({
      ok: false,
      reason: 'noUsableToy',
    });
  });

  it('starts an upset tummy on the 4th treat of the day', () => {
    let s = start();
    let fired: readonly string[] = [];
    for (let i = 0; i < 4; i += 1) {
      const out = act(s, { type: 'treat' }, CONFIG);
      if (!out.ok) throw new Error(out.reason);
      s = out.state;
      fired = out.fired;
    }
    expect(fired).toEqual(['upsetTummy']);
    expect(s.days.at(-1)!.events).toEqual(['upsetTummy']);
  });
});
