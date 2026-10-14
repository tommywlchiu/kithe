/** 0 to 100 each. There is no health, sickness-from-neglect, or alive/dead field (invariant 2). */
export type Needs = {
  fullness: number;
  cleanliness: number;
  playfulness: number;
  energy: number;
};

export type Mood = 'thriving' | 'content' | 'mopey';

/** Shape of `economy.needs` in @kithe/content. */
export type NeedsConfig = {
  floor: number;
  decayPerDay: { fullness: number; cleanliness: number; playfulness: number };
  mood: { thrivingAt: number; contentAt: number };
};

const MAX = 100;

/**
 * Needs after `days` midnights. Decay is per day, never per hour, and stops at the safety
 * floor (the free daily kibble), so the pup can look mopey but never starves. Energy refills
 * overnight. Rest Mode freezes everything.
 */
export function decayNeeds(
  needs: Needs,
  days: number,
  restMode: boolean,
  config: NeedsConfig,
): Needs {
  if (!Number.isInteger(days) || days < 0) {
    throw new RangeError(`days must be a whole number >= 0, got ${days}`);
  }
  if (restMode || days === 0) return { ...needs };
  const decay = (value: number, perDay: number) =>
    Math.max(config.floor, Math.min(MAX, value - perDay * days));
  return {
    fullness: decay(needs.fullness, config.decayPerDay.fullness),
    cleanliness: decay(needs.cleanliness, config.decayPerDay.cleanliness),
    playfulness: decay(needs.playfulness, config.decayPerDay.playfulness),
    energy: MAX,
  };
}

/** Average of fullness, cleanliness, and playfulness. Energy only changes naps, not mood. */
export function mood(needs: Needs, config: NeedsConfig): Mood {
  const average = (needs.fullness + needs.cleanliness + needs.playfulness) / 3;
  if (average >= config.mood.thrivingAt) return 'thriving';
  if (average >= config.mood.contentAt) return 'content';
  return 'mopey';
}

/** Adds to a need, capped at 100 and never below the floor. */
export function raiseNeed(value: number, amount: number, floor: number): number {
  return Math.max(floor, Math.min(MAX, value + amount));
}
