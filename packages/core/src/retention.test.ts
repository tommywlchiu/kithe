import { describe, expect, it } from 'vitest';

import type { GameState } from './game';
import { firstWeekRecap, planNotifications } from './retention';

const base = (over: Partial<GameState>): GameState => ({
  version: 1,
  pet: { name: 'Biscuit', breed: 'beagle', traits: [], adoptedOn: '2026-10-01', seed: 3 },
  clock: { lastDay: '2026-10-07', homeTimeZone: 'UTC' },
  care: {
    today: '2026-10-07',
    needs: { fullness: 80, cleanliness: 80, playfulness: 80, energy: 100 },
    bond: 0,
    ledger: [],
    treatsToday: 0,
    toys: [],
    trickProgress: {},
  },
  goal: { steps: 5000, exerciseMinutes: 30 },
  daysTogether: 6,
  restMode: false,
  events: { firedIds: [] },
  diary: [],
  days: [],
  ...over,
});

const day = (date: string, progress: number) => ({
  date,
  goal: { steps: 5000, exerciseMinutes: 30 },
  progress,
  earned: 0,
  events: [],
});

describe('firstWeekRecap', () => {
  it('is not available before the 7th day', () => {
    expect(
      firstWeekRecap(base({ clock: { lastDay: '2026-10-06', homeTimeZone: 'UTC' } })),
    ).toBeNull();
  });

  it('counts goal days, finds the best walk and the most detailed line of the first week', () => {
    const recap = firstWeekRecap(
      base({
        days: [
          day('2026-10-01', 0.5),
          day('2026-10-02', 1.2),
          day('2026-10-03', 1.6),
          day('2026-10-04', 0.2),
          day('2026-10-05', 1),
          day('2026-10-08', 3),
        ],
        diary: [
          { date: '2026-10-01', lineId: 'a', text: 'Short.' },
          { date: '2026-10-03', lineId: 'b', text: 'We found a pinecone on our long walk.' },
          {
            date: '2026-10-09',
            lineId: 'c',
            text: 'This happened after the first week, so skip it.',
          },
        ],
      }),
    );
    expect(recap).toEqual({
      daysTogether: 7,
      goalDays: 3,
      bestWalkDate: '2026-10-03',
      bestLine: 'We found a pinecone on our long walk.',
    });
  });

  it('works for a quiet first week with no walks', () => {
    expect(firstWeekRecap(base({ days: [day('2026-10-01', 0)] }))).toEqual({
      daysTogether: 7,
      goalDays: 0,
    });
  });

  it('says 7 days together even after a week of Rest Mode', () => {
    expect(firstWeekRecap(base({ daysTogether: 0, restMode: true }))?.daysTogether).toBe(7);
  });

  it('is shown through day 14, then steps aside', () => {
    const on = (lastDay: string) =>
      firstWeekRecap(base({ clock: { lastDay, homeTimeZone: 'UTC' } }));
    expect(on('2026-10-14')).not.toBeNull();
    expect(on('2026-10-15')).toBeNull();
  });
});

describe('planNotifications', () => {
  const copy = {
    dayOne: { id: 'd1', text: '{name} wrote something overnight.' },
    daily: [
      { id: 'a', text: '{name} found a leaf.' },
      { id: 'b', text: '{name} saved you the sunny spot.' },
      { id: 'c', text: '{name} has a new trick idea.' },
    ],
  };

  it('opens with the diary hook the morning after adoption', () => {
    const plan = planNotifications(base({}), copy, '2026-10-01', 3);
    expect(plan[0]).toEqual({ date: '2026-10-02', text: 'Biscuit wrote something overnight.' });
  });

  it('never repeats a line within one pass through the list, and is stable on reschedule', () => {
    const state = base({});
    const plan = planNotifications(state, copy, '2026-10-02', 3);
    expect(new Set(plan.map((p) => p.text)).size).toBe(3);
    expect(planNotifications(state, copy, '2026-10-02', 3)).toEqual(plan);
    expect(plan.every((p) => !p.text.includes('{name}'))).toBe(true);
  });
});
