import { applyCare, type CareAction, type CareConfig, type CareState, trickLearned } from './care';
import {
  type DayCounts,
  dailyEarnings,
  dailyProgress,
  type EarningsConfig,
  firstDayGoal,
  type GoalConfig,
  type MovementGoal,
  weeklyGoalAdjust,
} from './earnings';
import {
  type DiaryLine,
  type EventDef,
  type EventHistory,
  type EventReward,
  eventRewardGain,
  growthStage,
  type GrowthConfig,
  pickTemplate,
  scheduleEvents,
  type Stage,
} from './life';
import type { IsoDate } from './movement';
import { decayNeeds, type Mood, mood, type Needs } from './needs';
import { addDays, type Clock, daysBetween, localDate, rolloverDay, seededRandom } from './time';
import { balance, credit } from './wallet';

/** Everything the rules need, built from @kithe/content by its core-config adapter. */
export type GameConfig = {
  earnings: EarningsConfig;
  goal: GoalConfig;
  growth: GrowthConfig;
  care: CareConfig;
  events: readonly EventDef[];
  rewards: Readonly<Record<string, EventReward>>;
  diary: readonly DiaryLine[];
  traitTags: readonly string[];
  traitsPerPet: number;
  starterKit: number;
  adoptionNeeds: Needs;
};

export type DayRecord = {
  date: IsoDate;
  goal: MovementGoal;
  progress: number;
  earned: number;
  events: readonly string[];
};

export type DiaryEntry = { date: IsoDate; lineId: string; text: string };

export type GameState = {
  version: 1;
  pet: { name: string; breed: string; traits: readonly string[]; adoptedOn: IsoDate; seed: number };
  clock: Clock;
  care: CareState;
  goal: MovementGoal;
  pendingManualGoal?: MovementGoal;
  daysTogether: number;
  restMode: boolean;
  events: EventHistory;
  diary: readonly DiaryEntry[];
  /** Recent days, oldest first; movement can still sync into the last 7. */
  days: readonly DayRecord[];
};

const KEEP_DAYS = 35;
const SYNC_WINDOW_DAYS = 7;

const rngFor = (state: { pet: { seed: number; adoptedOn: IsoDate } }, date: IsoDate) =>
  seededRandom(state.pet.seed + daysBetween(state.pet.adoptedOn, date) * 7919);

const stageOf = (state: GameState, config: GameConfig): Stage =>
  growthStage(state.daysTogether, state.care.bond, config.growth);

export type AdoptInput = {
  name: string;
  breed: string;
  timeZone: string;
  nowMs: number;
  seed: number;
  startingGoal: MovementGoal;
};

/** Adoption: the starter kit, a well-fed pup, two traits, and an easy first day. */
export function adopt(input: AdoptInput, config: GameConfig): GameState {
  const today = localDate(input.nowMs, input.timeZone);
  const rng = seededRandom(input.seed);
  const pool = [...config.traitTags];
  const traits: string[] = [];
  while (traits.length < config.traitsPerPet && pool.length > 0) {
    traits.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]!);
  }
  const base: GameState = {
    version: 1,
    pet: {
      name: input.name.trim(),
      breed: input.breed,
      traits,
      adoptedOn: today,
      seed: input.seed,
    },
    clock: { lastDay: today, homeTimeZone: input.timeZone },
    care: {
      today,
      needs: { ...config.adoptionNeeds },
      bond: 0,
      ledger: [credit(today, config.starterKit, { kind: 'starterKit' })],
      treatsToday: 0,
      toys: [],
      trickProgress: {},
    },
    goal: input.startingGoal,
    daysTogether: 0,
    restMode: false,
    events: { firedIds: [] },
    diary: [],
    days: [
      {
        date: today,
        goal: firstDayGoal(input.startingGoal, config.goal),
        progress: 0,
        earned: 0,
        events: [],
      },
    ],
  };
  return writeDiary(base, today, ['firstDay'], config);
}

function writeDiary(
  state: GameState,
  date: IsoDate,
  dayTags: string[],
  config: GameConfig,
): GameState {
  if (config.diary.length === 0) return state;
  const recent = state.diary.slice(-7).map((e) => e.lineId);
  try {
    const line = pickTemplate(
      config.diary,
      { dayTags, traits: state.pet.traits, traitTags: config.traitTags, petName: state.pet.name },
      recent,
      rngFor(state, date),
    );
    return { ...state, diary: [...state.diary, { date, lineId: line.id, text: line.text }] };
  } catch {
    return state;
  }
}

function currentTrick(state: GameState, config: GameConfig): string | undefined {
  return Object.keys(config.care.tricks).find((id) => !trickLearned(state.care, id, config.care));
}

function applyEvents(state: GameState, fired: readonly string[], config: GameConfig): GameState {
  let next = state;
  const today = mood(state.care.needs, config.care.needs);
  for (const id of fired) {
    const gain = eventRewardGain(config.rewards[id] ?? null, today);
    const trick = currentTrick(next, config);
    next = {
      ...next,
      care: {
        ...next.care,
        bond: next.care.bond + gain.bond,
        trickProgress:
          trick && gain.trickProgress > 0
            ? {
                ...next.care.trickProgress,
                [trick]: (next.care.trickProgress[trick] ?? 0) + gain.trickProgress,
              }
            : next.care.trickProgress,
      },
    };
  }
  return next;
}

/** Start of one new day: overnight decay, a day together, the weekly goal, events, a diary line. */
function startDay(state: GameState, date: IsoDate, config: GameConfig): GameState {
  const yesterday = state.days[state.days.length - 1];
  const stageBefore = stageOf(state, config);
  let next: GameState = {
    ...state,
    care: {
      ...state.care,
      today: date,
      treatsToday: 0,
      needs: decayNeeds(state.care.needs, 1, state.restMode, config.care.needs),
    },
    daysTogether: state.daysTogether + (state.restMode ? 0 : 1),
  };

  const dayNumber = daysBetween(state.pet.adoptedOn, date) + 1;
  if (dayNumber > 1 && (dayNumber - 1) % 7 === 0) {
    const daysHit = next.days.slice(-7).filter((d) => d.progress >= 1).length;
    next = {
      ...next,
      goal: weeklyGoalAdjust(next.goal, daysHit, config.goal, next.pendingManualGoal),
      pendingManualGoal: undefined,
    };
  }

  const scheduled = scheduleEvents(
    {
      date,
      dayNumber,
      restMode: next.restMode,
      goalBeatYesterday: (yesterday?.progress ?? 0) > 1,
      treatsOverLimit: false,
    },
    config.events,
    next.events,
    rngFor(next, date),
  );
  next = applyEvents({ ...next, events: scheduled.history }, scheduled.fired, config);
  next = {
    ...next,
    days: [
      ...next.days,
      { date, goal: next.goal, progress: 0, earned: 0, events: scheduled.fired },
    ].slice(-KEEP_DAYS),
  };

  const tags: string[] = [...scheduled.fired];
  if (next.restMode) tags.push('restMode');
  else if (yesterday) tags.push(yesterday.progress >= 1 ? 'goalHit' : 'goalMissed');
  if (stageOf(next, config) !== stageBefore) tags.push('growth');
  return writeDiary(next, date, tags, config);
}

/**
 * Brings the game up to the current day in the home time zone. Days older than the 7-day
 * catch-up window still count as days together (outside Rest Mode) and still decay to the
 * floor, but get no events or diary.
 */
export function advanceToNow(state: GameState, nowMs: number, config: GameConfig): GameState {
  const roll = rolloverDay(state.clock, nowMs);
  if (roll.newDays.length === 0) return state;
  let next: GameState = { ...state, clock: roll.clock };
  if (roll.skippedDays > 0) {
    next = {
      ...next,
      care: {
        ...next.care,
        needs: decayNeeds(next.care.needs, roll.skippedDays, next.restMode, config.care.needs),
      },
      daysTogether: next.daysTogether + (next.restMode ? 0 : roll.skippedDays),
    };
  }
  for (const date of roll.newDays) next = startDay(next, date, config);
  return next;
}

/**
 * Credits Pawprints for movement on recent days. Totals only ever top up (late watch data
 * adds, a lower re-read never takes Pawprints back), and only days in the 7-day window sync.
 */
export function syncMovement(
  state: GameState,
  countsByDate: Readonly<Record<IsoDate, DayCounts>>,
  config: GameConfig,
): GameState {
  const oldest = addDays(state.clock.lastDay, -(SYNC_WINDOW_DAYS - 1));
  let ledger = state.care.ledger;
  const days = state.days.map((day) => {
    const counts = countsByDate[day.date];
    if (!counts || day.date < oldest) return day;
    const progress = dailyProgress(counts, day.goal);
    const earned = dailyEarnings(progress, config.earnings);
    const delta = earned - day.earned;
    if (delta > 0) ledger = [...ledger, credit(day.date, delta, { kind: 'movement' })];
    return {
      ...day,
      progress: Math.max(day.progress, progress),
      earned: Math.max(day.earned, earned),
    };
  });
  return { ...state, days, care: { ...state.care, ledger } };
}

export type ActOutcome =
  { ok: true; state: GameState; fired: readonly string[] } | { ok: false; reason: string };

/** One care action, then the same-day event check (a 4th treat can start an upset tummy). */
export function act(state: GameState, action: CareAction, config: GameConfig): ActOutcome {
  const outcome = applyCare(state.care, action, config.care);
  if (!outcome.ok) return { ok: false, reason: outcome.reason };
  let next: GameState = { ...state, care: outcome.state };
  if (!outcome.triggered.includes('treatsOverLimit')) return { ok: true, state: next, fired: [] };
  const date = state.clock.lastDay;
  const scheduled = scheduleEvents(
    {
      date,
      dayNumber: daysBetween(state.pet.adoptedOn, date) + 1,
      restMode: next.restMode,
      goalBeatYesterday: false,
      treatsOverLimit: true,
    },
    config.events,
    next.events,
    rngFor(next, date),
  );
  next = applyEvents({ ...next, events: scheduled.history }, scheduled.fired, config);
  const days = next.days.map((d, i) =>
    i === next.days.length - 1 ? { ...d, events: [...d.events, ...scheduled.fired] } : d,
  );
  return { ok: true, state: { ...next, days }, fired: scheduled.fired };
}

export function setRestMode(state: GameState, on: boolean): GameState {
  return { ...state, restMode: on };
}

/** A lowered goal waits for the next week boundary. */
export function requestGoal(state: GameState, goal: MovementGoal, config: GameConfig): GameState {
  return { ...state, pendingManualGoal: weeklyGoalAdjust(goal, 3, config.goal) };
}

export type ArtState = 'thriving' | 'content' | 'mopey' | 'sleeping';

export type GameView = {
  mood: Mood;
  stage: Stage;
  art: ArtState;
  balance: number;
  today: DayRecord;
  todaysDiary?: DiaryEntry;
  daysTogether: number;
};

export function view(state: GameState, config: GameConfig): GameView {
  const currentMood = mood(state.care.needs, config.care.needs);
  const today = state.days[state.days.length - 1]!;
  return {
    mood: currentMood,
    stage: stageOf(state, config),
    art: state.restMode ? 'sleeping' : currentMood,
    balance: balance(state.care.ledger),
    today,
    todaysDiary: state.diary.filter((e) => e.date === today.date).at(-1),
    daysTogether: state.daysTogether,
  };
}
