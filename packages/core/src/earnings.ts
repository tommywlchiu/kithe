import { clamp } from './clamp';

export type MovementGoal = { steps: number; exerciseMinutes: number };

export type DayCounts = { steps: number; exerciseMinutes: number; wheelchairPushes: number };

/** Shape of `economy.earnings` in @kithe/content. */
export type EarningsConfig = { atGoal: number; dailyCap: number };

/** Shape of `economy.goal` in @kithe/content. */
export type GoalConfig = {
  minSteps: number;
  maxSteps: number;
  minExerciseMinutes: number;
  maxExerciseMinutes: number;
  firstDayMultiplier: number;
  weeklyAdjustPct: number;
  raiseAfterDaysHit: number;
  lowerAtOrBelowDaysHit: number;
};

function assertCount(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite number >= 0, got ${value}`);
  }
}

/**
 * Progress toward the goal as a fraction (1 = goal met). The best of steps, exercise
 * minutes, and wheelchair pushes counts, so one walk is never counted twice. Pushes are
 * measured against the step goal.
 */
export function dailyProgress(counts: DayCounts, goal: MovementGoal): number {
  assertCount(counts.steps, 'steps');
  assertCount(counts.exerciseMinutes, 'exerciseMinutes');
  assertCount(counts.wheelchairPushes, 'wheelchairPushes');
  if (!(goal.steps > 0) || !(goal.exerciseMinutes > 0)) {
    throw new RangeError('goal values must be > 0');
  }
  return Math.max(
    counts.steps / goal.steps,
    counts.exerciseMinutes / goal.exerciseMinutes,
    counts.wheelchairPushes / goal.steps,
  );
}

/** Linear to `atGoal` at 100%, then linear up to `dailyCap` at 200%, floored, never more. */
export function dailyEarnings(progress: number, config: EarningsConfig): number {
  assertCount(progress, 'progress');
  if (progress <= 1) return Math.floor(config.atGoal * progress);
  const bonus = (config.dailyCap - config.atGoal) * Math.min(progress - 1, 1);
  return Math.floor(config.atGoal + bonus);
}

const mean = (values: readonly number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

export type StartingGoalInput =
  /** iOS: daily totals from the last 14 days of Health history; days with no data left out. */
  | { kind: 'history'; dailySteps: readonly number[]; dailyExerciseMinutes: readonly number[] }
  /** Android: history is usually empty, so onboarding asks for typical daily steps. */
  | { kind: 'answer'; typicalSteps: number };

export function startingGoal(input: StartingGoalInput, config: GoalConfig): MovementGoal {
  if (input.kind === 'answer') {
    assertCount(input.typicalSteps, 'typicalSteps');
    const steps = Math.round(clamp(input.typicalSteps, config.minSteps, config.maxSteps));
    // Exercise minutes follow the step answer proportionally within their own range.
    const t = (steps - config.minSteps) / (config.maxSteps - config.minSteps);
    const exerciseMinutes = Math.round(
      config.minExerciseMinutes + t * (config.maxExerciseMinutes - config.minExerciseMinutes),
    );
    return { steps, exerciseMinutes };
  }
  const steps = input.dailySteps.filter((v) => Number.isFinite(v) && v > 0);
  const minutes = input.dailyExerciseMinutes.filter((v) => Number.isFinite(v) && v > 0);
  return {
    steps: Math.round(
      clamp(steps.length ? mean(steps) : config.minSteps, config.minSteps, config.maxSteps),
    ),
    exerciseMinutes: Math.round(
      clamp(
        minutes.length ? mean(minutes) : config.minExerciseMinutes,
        config.minExerciseMinutes,
        config.maxExerciseMinutes,
      ),
    ),
  };
}

/** Day 1 is a guaranteed win: a fraction of the starting goal (not clamped to the floor). */
export function firstDayGoal(goal: MovementGoal, config: GoalConfig): MovementGoal {
  return {
    steps: Math.max(1, Math.round(goal.steps * config.firstDayMultiplier)),
    exerciseMinutes: Math.max(1, Math.round(goal.exerciseMinutes * config.firstDayMultiplier)),
  };
}

function clampGoal(goal: MovementGoal, config: GoalConfig): MovementGoal {
  return {
    steps: Math.round(clamp(goal.steps, config.minSteps, config.maxSteps)),
    exerciseMinutes: Math.round(
      clamp(goal.exerciseMinutes, config.minExerciseMinutes, config.maxExerciseMinutes),
    ),
  };
}

/**
 * Goal for the coming week. A goal the player lowered by hand during the week takes effect
 * now, at the week boundary; otherwise 5+ goal days raise it and 0 to 1 lower it.
 */
export function weeklyGoalAdjust(
  goal: MovementGoal,
  daysHit: number,
  config: GoalConfig,
  pendingManualGoal?: MovementGoal,
): MovementGoal {
  if (!Number.isInteger(daysHit) || daysHit < 0 || daysHit > 7) {
    throw new RangeError(`daysHit must be an integer 0 to 7, got ${daysHit}`);
  }
  if (pendingManualGoal) return clampGoal(pendingManualGoal, config);
  let factor = 1;
  if (daysHit >= config.raiseAfterDaysHit) factor = 1 + config.weeklyAdjustPct;
  else if (daysHit <= config.lowerAtOrBelowDaysHit) factor = 1 - config.weeklyAdjustPct;
  return clampGoal(
    { steps: goal.steps * factor, exerciseMinutes: goal.exerciseMinutes * factor },
    config,
  );
}
