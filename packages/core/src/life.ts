import type { IsoDate } from './movement';
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
  firedIds: readonly string[];
  lastNegativeDate?: IsoDate;
};

const NEGATIVE_SPACING_DAYS = 7;

/**
 * Events that start today. Rest Mode is a cozy nap, so nothing starts during it. At most one
 * negative event fires in any 7-day window; a blocked one-time event waits and fires once
 * the window clears. `rng` is seeded so a day replays the same way.
 */
export function scheduleEvents(
  facts: DayFacts,
  events: readonly EventDef[],
  history: EventHistory,
  rng: () => number,
): string[] {
  if (facts.restMode) return [];
  let lastNegative = history.lastNegativeDate;
  const fired: string[] = [];
  for (const event of events) {
    const trigger = event.trigger;
    let due = false;
    switch (trigger.type) {
      case 'onDay':
        due = facts.dayNumber >= trigger.day && !history.firedIds.includes(event.id);
        break;
      case 'afterGoalBeat':
        due = facts.goalBeatYesterday;
        break;
      case 'randomDaily':
        due = rng() < trigger.chance;
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
  return fired;
}

export type DiaryLine = { id: string; text: string; tags: readonly string[] };

/**
 * A diary line for today. Lines tagged with something that happened today are preferred, so
 * every entry mentions something concrete; the pup's traits break ties. The last 7 lines are
 * never repeated while any other choice exists.
 */
export function pickTemplate(
  lines: readonly DiaryLine[],
  context: { dayTags: readonly string[]; traits: readonly string[]; petName: string },
  recentIds: readonly string[],
  rng: () => number,
): { id: string; text: string } {
  if (lines.length === 0) throw new RangeError('pickTemplate needs at least one line');
  const recent = new Set(recentIds.slice(-7));
  const fresh = lines.filter((l) => !recent.has(l.id));
  const pool = fresh.length > 0 ? fresh : lines;
  const score = (l: DiaryLine) =>
    l.tags.filter((t) => context.dayTags.includes(t)).length * 10 +
    l.tags.filter((t) => context.traits.includes(t)).length;
  const best = Math.max(...pool.map(score));
  const top = pool.filter((l) => score(l) === best);
  const line = top[Math.floor(rng() * top.length)]!;
  return { id: line.id, text: line.text.replaceAll('{name}', context.petName) };
}
