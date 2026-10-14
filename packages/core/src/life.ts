import type { IsoDate } from './movement';
import type { Mood } from './needs';
import { daysBetween } from './time';

export type Stage = 'puppy' | 'adolescent' | 'adult';

/** Shape of `economy.growth` in @kithe/content. */
export type GrowthConfig = {
  adolescent: { days: number; bond: number };
  adult: { days: number; bond: number };
};

/**
 * Growth needs both calendar time and bond (invariant 7), so nothing purchasable can rush it.
 * `daysTogether` excludes Rest Mode days, which pause growth. Adults stay adults.
 */
export function growthStage(daysTogether: number, bond: number, config: GrowthConfig): Stage {
  if (daysTogether >= config.adult.days && bond >= config.adult.bond) return 'adult';
  if (daysTogether >= config.adolescent.days && bond >= config.adolescent.bond) {
    return 'adolescent';
  }
  return 'puppy';
}

/** Shape of each entry in `events.events` from @kithe/content (fields core reads). */
export type EventDef = {
  id: string;
  negative: boolean;
  trigger:
    | { type: 'onDay'; day: number }
    | { type: 'afterGoalBeat' }
    | { type: 'randomDaily'; chance: number }
    | { type: 'treatsOverLimit' };
};

export type DayFacts = {
  date: IsoDate;
  /** 1 on adoption day. */
  dayNumber: number;
  restMode: boolean;
  goalBeatYesterday: boolean;
  treatsOverLimit: boolean;
};

export type EventHistory = {
  /** One-time (onDay) events that already happened. */
  firedIds: readonly string[];
  lastNegativeDate?: IsoDate;
  /** The day the scheduler last ran and what fired then, so a second run that day is safe. */
  lastRun?: { date: IsoDate; fired: readonly string[] };
};

/** Shape of an event's `reward` in @kithe/content. */
export type EventReward = { bond?: number; trickProgress?: number } | null;

const NEGATIVE_SPACING_DAYS = 7;

/**
 * Events that start today, plus the updated history to store. Rest Mode is a cozy nap, so
 * nothing starts during it. At most one negative event fires in any 7-day window; a blocked
 * one-time event waits and fires once the window clears. Running it again on the same day
 * (for example after a 4th treat) only checks same-day triggers, never re-rolls the random
 * ones and never repeats an event, so a seeded day replays the same way.
 */
export function scheduleEvents(
  facts: DayFacts,
  events: readonly EventDef[],
  history: EventHistory,
  rng: () => number,
): { fired: string[]; history: EventHistory } {
  if (facts.restMode) return { fired: [], history };
  const rerun = history.lastRun?.date === facts.date;
  const firedToday = new Set(rerun ? history.lastRun!.fired : []);
  let lastNegative = history.lastNegativeDate;
  const fired: string[] = [];
  for (const event of events) {
    if (firedToday.has(event.id)) continue;
    const trigger = event.trigger;
    let due = false;
    switch (trigger.type) {
      case 'onDay':
        due = !rerun && facts.dayNumber >= trigger.day && !history.firedIds.includes(event.id);
        break;
      case 'afterGoalBeat':
        due = !rerun && facts.goalBeatYesterday;
        break;
      case 'randomDaily':
        due = !rerun && rng() < trigger.chance;
        break;
      case 'treatsOverLimit':
        due = facts.treatsOverLimit;
        break;
    }
    if (!due) continue;
    if (event.negative) {
      if (lastNegative && daysBetween(lastNegative, facts.date) < NEGATIVE_SPACING_DAYS) continue;
      lastNegative = facts.date;
    }
    fired.push(event.id);
  }
  const oneTime = new Set(events.filter((e) => e.trigger.type === 'onDay').map((e) => e.id));
  return {
    fired,
    history: {
      firedIds: [...history.firedIds, ...fired.filter((id) => oneTime.has(id))],
      ...(lastNegative ? { lastNegativeDate: lastNegative } : {}),
      lastRun: { date: facts.date, fired: [...firedToday, ...fired] },
    },
  };
}

/**
 * What an event gives. Bond is withheld while the pup is mopey, the same as care (mopey pets
 * earn no bond), and trick progress goes to the trick being learned. Rewards never include
 * Pawprints or Stars.
 */
export function eventRewardGain(
  reward: EventReward,
  currentMood: Mood,
): { bond: number; trickProgress: number } {
  return {
    bond: currentMood === 'mopey' ? 0 : (reward?.bond ?? 0),
    trickProgress: reward?.trickProgress ?? 0,
  };
}

export type DiaryLine = { id: string; text: string; tags: readonly string[] };

/**
 * A diary line for today. A line tagged with something that happens on particular days
 * (an event, a goal day, the first day) is only eligible when all of those things happened
 * today, so the diary never mentions a sock that was not stolen. Among eligible lines, the
 * ones about today's facts win and the pup's traits break ties. The last 7 lines are never
 * repeated while any other choice exists. `traitTags` is the full trait vocabulary, which
 * separates personality tags from day facts.
 */
export function pickTemplate(
  lines: readonly DiaryLine[],
  context: {
    dayTags: readonly string[];
    traits: readonly string[];
    traitTags: readonly string[];
    petName: string;
  },
  recentIds: readonly string[],
  rng: () => number,
): { id: string; text: string } {
  if (lines.length === 0) throw new RangeError('pickTemplate needs at least one line');
  const isTrait = (t: string) => context.traitTags.includes(t);
  const eligible = lines.filter((l) =>
    l.tags.every((t) => isTrait(t) || context.dayTags.includes(t)),
  );
  const candidates = eligible.length > 0 ? eligible : lines.filter((l) => l.tags.every(isTrait));
  if (candidates.length === 0) throw new RangeError('no diary line fits today');
  const recent = new Set(recentIds.slice(-7));
  const fresh = candidates.filter((l) => !recent.has(l.id));
  const pool = fresh.length > 0 ? fresh : candidates;
  const score = (l: DiaryLine) =>
    l.tags.filter((t) => context.dayTags.includes(t)).length * 10 +
    l.tags.filter((t) => context.traits.includes(t)).length;
  const best = Math.max(...pool.map(score));
  const top = pool.filter((l) => score(l) === best);
  const line = top[Math.floor(rng() * top.length)]!;
  return { id: line.id, text: line.text.replaceAll('{name}', context.petName) };
}
