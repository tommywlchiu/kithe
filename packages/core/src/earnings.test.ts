import { describe, expect, it } from 'vitest';

import {
  dailyEarnings,
  dailyProgress,
  type EarningsConfig,
  firstDayGoal,
  type GoalConfig,
  startingGoal,
  weeklyGoalAdjust,
} from './earnings';

// Spec values (docs/specs/phase-0-concept-art-prototype.md, Core logic).
const EARNINGS: EarningsConfig = { atGoal: 100, dailyCap: 125 };
const GOAL: GoalConfig = {
  minSteps: 2000,
  maxSteps: 10000,
  minExerciseMinutes: 15,
  maxExerciseMinutes: 60,
  firstDayMultiplier: 0.5,
  weeklyAdjustPct: 0.1,
  raiseAfterDaysHit: 5,
  lowerAtOrBelowDaysHit: 1,
};
const goal = { steps: 6000, exerciseMinutes: 30 };

describe('dailyProgress', () => {
  it('takes the best of steps, exercise, and pushes instead of adding them', () => {
    expect(dailyProgress({ steps: 3000, exerciseMinutes: 30, wheelchairPushes: 0 }, goal)).toBe(1);
    expect(dailyProgress({ steps: 3000, exerciseMinutes: 10, wheelchairPushes: 0 }, goal)).toBe(
      0.5,
    );
  });

  it('measures wheelchair pushes against the step goal', () => {
    expect(dailyProgress({ steps: 0, exerciseMinutes: 0, wheelchairPushes: 6000 }, goal)).toBe(1);
  });

  it('rejects negative or non-finite counts and empty goals', () => {
    expect(() =>
      dailyProgress({ steps: -1, exerciseMinutes: 0, wheelchairPushes: 0 }, goal),
    ).toThrow(RangeError);
    expect(() =>
      dailyProgress({ steps: Number.NaN, exerciseMinutes: 0, wheelchairPushes: 0 }, goal),
    ).toThrow(RangeError);
    expect(() =>
      dailyProgress(
        { steps: 1, exerciseMinutes: 0, wheelchairPushes: 0 },
        { steps: 0, exerciseMinutes: 30 },
      ),
    ).toThrow(RangeError);
  });
});

describe('dailyEarnings', () => {
  it.each([
    [0, 0],
    [0.5, 50],
    [1, 100],
    [1.5, 112],
    [2, 125],
    [3, 125],
  ])('progress %s earns %s Pawprints', (progress, pawprints) => {
    expect(dailyEarnings(progress, EARNINGS)).toBe(pawprints);
  });

  it('does not short the player on floating-point progress values', () => {
    expect(dailyEarnings(570 / 1000, EARNINGS)).toBe(57);
    expect(dailyEarnings(0.29, EARNINGS)).toBe(29);
    expect(dailyEarnings(0.58, EARNINGS)).toBe(58);
  });

  it('never exceeds the daily cap', () => {
    for (let p = 0; p <= 10; p += 0.07) {
      expect(dailyEarnings(p, EARNINGS)).toBeLessThanOrEqual(EARNINGS.dailyCap);
    }
  });

  it('throws on negative or NaN progress', () => {
    expect(() => dailyEarnings(-0.1, EARNINGS)).toThrow(RangeError);
    expect(() => dailyEarnings(Number.NaN, EARNINGS)).toThrow(RangeError);
  });
});

describe('startingGoal', () => {
  it('averages the days with data and clamps to the allowed range', () => {
    expect(
      startingGoal(
        { kind: 'history', dailySteps: [4000, 6000, 0], dailyExerciseMinutes: [20, 40] },
        GOAL,
      ),
    ).toEqual({ steps: 5000, exerciseMinutes: 30 });
    expect(
      startingGoal({ kind: 'history', dailySteps: [25000], dailyExerciseMinutes: [5] }, GOAL),
    ).toEqual({ steps: 10000, exerciseMinutes: 15 });
  });

  it('falls back to the minimum goal when history is empty', () => {
    expect(
      startingGoal({ kind: 'history', dailySteps: [], dailyExerciseMinutes: [] }, GOAL),
    ).toEqual({ steps: 2000, exerciseMinutes: 15 });
  });

  it('uses the onboarding answer on Android, scaling exercise minutes with it', () => {
    expect(startingGoal({ kind: 'answer', typicalSteps: 6000 }, GOAL)).toEqual({
      steps: 6000,
      exerciseMinutes: 38,
    });
    expect(startingGoal({ kind: 'answer', typicalSteps: 500 }, GOAL)).toEqual({
      steps: 2000,
      exerciseMinutes: 15,
    });
  });
});

describe('firstDayGoal', () => {
  it('halves the starting goal for a guaranteed first win', () => {
    expect(firstDayGoal({ steps: 5000, exerciseMinutes: 30 }, GOAL)).toEqual({
      steps: 2500,
      exerciseMinutes: 15,
    });
  });
});

describe('weeklyGoalAdjust', () => {
  it('raises 10% after 5 or more goal days', () => {
    expect(weeklyGoalAdjust(goal, 5, GOAL)).toEqual({ steps: 6600, exerciseMinutes: 33 });
  });

  it('lowers 10% after 1 goal day or fewer', () => {
    expect(weeklyGoalAdjust(goal, 1, GOAL)).toEqual({ steps: 5400, exerciseMinutes: 27 });
    expect(weeklyGoalAdjust(goal, 0, GOAL)).toEqual({ steps: 5400, exerciseMinutes: 27 });
  });

  it('keeps the goal for 2 to 4 goal days', () => {
    expect(weeklyGoalAdjust(goal, 3, GOAL)).toEqual(goal);
  });

  it('never drops below the floor or above the ceiling', () => {
    expect(weeklyGoalAdjust({ steps: 2000, exerciseMinutes: 15 }, 0, GOAL)).toEqual({
      steps: 2000,
      exerciseMinutes: 15,
    });
    expect(weeklyGoalAdjust({ steps: 10000, exerciseMinutes: 60 }, 7, GOAL)).toEqual({
      steps: 10000,
      exerciseMinutes: 60,
    });
  });

  it('applies a hand-lowered goal at the week boundary instead of the automatic change', () => {
    expect(weeklyGoalAdjust(goal, 7, GOAL, { steps: 3000, exerciseMinutes: 20 })).toEqual({
      steps: 3000,
      exerciseMinutes: 20,
    });
    expect(weeklyGoalAdjust(goal, 7, GOAL, { steps: 100, exerciseMinutes: 1 })).toEqual({
      steps: 2000,
      exerciseMinutes: 15,
    });
  });

  it('ignores a hand-set goal that is higher, so manual changes only ease the goal down', () => {
    expect(weeklyGoalAdjust(goal, 0, GOAL, { steps: 9000, exerciseMinutes: 45 })).toEqual({
      steps: 5400,
      exerciseMinutes: 27,
    });
  });

  it('rejects impossible day counts', () => {
    expect(() => weeklyGoalAdjust(goal, 8, GOAL)).toThrow(RangeError);
    expect(() => weeklyGoalAdjust(goal, 2.5, GOAL)).toThrow(RangeError);
  });
});
