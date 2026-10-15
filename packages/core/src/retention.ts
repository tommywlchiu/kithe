import type { GameState } from './game';
import type { IsoDate } from './movement';
import { seededRandom } from './time';
import { addDays, daysBetween } from './time';

export type FirstWeekRecap = {
  daysTogether: number;
  goalDays: number;
  bestWalkDate?: IsoDate;
  bestLine?: string;
};

const FIRST_WEEK = 7;

/**
 * The "Our first week" card, available from the 7th day after adoption. Counts goal days in
 * the first 7, the day with the most movement, and the most detailed diary line of the week.
 */
export function firstWeekRecap(state: GameState): FirstWeekRecap | null {
  const dayNumber = daysBetween(state.pet.adoptedOn, state.clock.lastDay) + 1;
  if (dayNumber < FIRST_WEEK) return null;
  const lastFirstWeekDay = addDays(state.pet.adoptedOn, FIRST_WEEK - 1);
  const week = state.days.filter((d) => d.date <= lastFirstWeekDay);
  const best = week.reduce<(typeof week)[number] | undefined>(
    (top, d) => (d.progress > 0 && (!top || d.progress > top.progress) ? d : top),
    undefined,
  );
  const lines = state.diary.filter((e) => e.date <= lastFirstWeekDay);
  const bestLine = lines.reduce<string | undefined>(
    (top, e) => (!top || e.text.length > top.length ? e.text : top),
    undefined,
  );
  return {
    daysTogether: Math.min(state.daysTogether, FIRST_WEEK),
    goalDays: week.filter((d) => d.progress >= 1).length,
    ...(best ? { bestWalkDate: best.date } : {}),
    ...(bestLine ? { bestLine } : {}),
  };
}

export type CopyLine = { id: string; text: string };

/**
 * Notification text for each of the next `count` days after `fromDate`, in order. The day
 * after adoption gets the diary hook; other days rotate through the good-news lines without
 * repeating, seeded by the pet so a reschedule picks the same lines.
 */
export function planNotifications(
  state: GameState,
  copy: { daily: readonly CopyLine[]; dayOne: CopyLine },
  fromDate: IsoDate,
  count: number,
): { date: IsoDate; text: string }[] {
  const dayAfterAdoption = addDays(state.pet.adoptedOn, 1);
  const fill = (text: string) => text.replaceAll('{name}', state.pet.name);
  return Array.from({ length: count }, (_, i) => {
    const date = addDays(fromDate, i + 1);
    if (date === dayAfterAdoption) return { date, text: fill(copy.dayOne.text) };
    const n = daysBetween(state.pet.adoptedOn, date);
    const cycle = Math.floor(n / copy.daily.length);
    const order = shuffled(copy.daily.length, state.pet.seed + cycle);
    return { date, text: fill(copy.daily[order[n % copy.daily.length]!]!.text) };
  });
}

function shuffled(length: number, seed: number): number[] {
  const rng = seededRandom(seed);
  const order = Array.from({ length }, (_, i) => i);
  for (let i = length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
}
