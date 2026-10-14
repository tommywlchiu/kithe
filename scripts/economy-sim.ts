import {
  careConfig,
  earningsConfig,
  economy,
  eventDefs,
  events as contentEvents,
  growthConfig,
  needsConfig,
  starterKitPawprints,
} from '@kithe/content';
import {
  addDays,
  applyCare,
  balance,
  type CareAction,
  type CareState,
  credit,
  dailyEarnings,
  type EventHistory,
  eventRewardGain,
  daysBetween,
  decayNeeds,
  growthStage,
  type Mood,
  mood,
  scheduleEvents,
  seededRandom,
} from '@kithe/core';

// 90 days of four player types (design doc, "Weekly balance by player type") through the real
// rules and content. Exits non-zero when a balancing target fails, so CI guards every price
// change. Progress is the day's fraction of the personal goal.
const PLAYERS = {
  active: [2, 2, 2, 2, 2, 2, 0.8],
  average: [1, 1, 1, 1, 0.6, 0.6, 0.6],
  sporadic: [1, 1, 0.3, 0.3, 0.3, 0.3, 0.3],
  inactive: [0.15, 0.15, 0.15, 0.15, 0.15, 0.15, 0.15],
} as const;
type PlayerName = keyof typeof PLAYERS;

const DAYS = 90;
const START = '2026-01-05';
const TRICK = 'sit';
const toyIds = Object.entries(careConfig.toys)
  .sort(([, a], [, b]) => a.price - b.price)
  .map(([id]) => id);
const rewards = new Map(contentEvents.events.map((e) => [e.id as string, e.reward]));
// The adoption state arrives with onboarding (T8); until then the sim adopts a well-fed pup.
const ADOPTION_NEEDS = { fullness: 80, cleanliness: 80, playfulness: 80, energy: 100 };

type Result = {
  player: PlayerName;
  finalBalance: number;
  maxEarnedInADay: number;
  moods: Record<Mood, number>;
  minNeed: number;
  adolescentDay: number | null;
  adultDay: number | null;
  toysBought: number;
  trickLearnedDay: number | null;
  basicCareSpend: number;
  totalEarned: number;
  negativeDates: string[];
};

function simulate(player: PlayerName, seed: number): Result {
  const weekly = PLAYERS[player];
  const rng = seededRandom(seed);
  let state: CareState = {
    today: START,
    needs: ADOPTION_NEEDS,
    bond: 0,
    ledger: [credit(START, starterKitPawprints, { kind: 'starterKit' })],
    treatsToday: 0,
    toys: [],
    trickProgress: {},
  };
  let eventHistory: EventHistory = { firedIds: [] };
  const r: Result = {
    player,
    finalBalance: 0,
    maxEarnedInADay: 0,
    moods: { thriving: 0, content: 0, mopey: 0 },
    minNeed: 100,
    adolescentDay: null,
    adultDay: null,
    toysBought: 0,
    trickLearnedDay: null,
    basicCareSpend: 0,
    totalEarned: 0,
    negativeDates: [],
  };

  const tryCare = (action: CareAction, basic = false): boolean => {
    const before = balance(state.ledger);
    const out = applyCare(state, action, careConfig);
    if (!out.ok) return false;
    state = out.state;
    if (basic) r.basicCareSpend += before - balance(state.ledger);
    if (action.type === 'buyToy') r.toysBought += 1;
    return true;
  };

  for (let day = 1; day <= DAYS; day += 1) {
    const date = addDays(START, day - 1);
    if (day > 1) {
      state = {
        ...state,
        today: date,
        needs: decayNeeds(state.needs, 1, false, needsConfig),
        treatsToday: 0,
      };
    }

    const progress = weekly[(day - 1) % 7]!;
    const earned = dailyEarnings(progress, earningsConfig);
    r.maxEarnedInADay = Math.max(r.maxEarnedInADay, earned);
    r.totalEarned += earned;
    if (earned > 0) {
      state = { ...state, ledger: [...state.ledger, credit(date, earned, { kind: 'movement' })] };
    }

    // An attentive player: basics first, then fun, then saving toward a trick.
    tryCare({ type: 'meal' }, true);
    tryCare({ type: 'meal' }, true);
    if (day % 2 === 0) tryCare({ type: 'brushing' }, true);
    const usable = state.toys.find((t) => t.wearDaysLeft > 0);
    if (usable) {
      tryCare({ type: 'play', toyId: usable.toyId });
    } else {
      for (const id of toyIds) if (tryCare({ type: 'buyToy', toyId: id })) break;
      const bought = state.toys.find((t) => t.wearDaysLeft > 0);
      if (bought) tryCare({ type: 'play', toyId: bought.toyId });
    }
    if (balance(state.ledger) >= careConfig.prices.trainingSession + 40) {
      tryCare({ type: 'trainingSession', trickId: TRICK });
    }
    if (
      r.trickLearnedDay === null &&
      (state.trickProgress[TRICK] ?? 0) >= careConfig.tricks[TRICK]!
    ) {
      r.trickLearnedDay = day;
    }

    const today = mood(state.needs, needsConfig);
    r.moods[today] += 1;
    r.minNeed = Math.min(
      r.minNeed,
      state.needs.fullness,
      state.needs.cleanliness,
      state.needs.playfulness,
    );

    const scheduled = scheduleEvents(
      {
        date,
        dayNumber: day,
        restMode: false,
        goalBeatYesterday: day > 1 && weekly[(day - 2) % 7]! > 1,
        treatsOverLimit: state.treatsToday > careConfig.treatDailyLimit,
      },
      eventDefs,
      eventHistory,
      rng,
    );
    eventHistory = scheduled.history;
    for (const id of scheduled.fired) {
      if (eventDefs.find((e) => e.id === id)!.negative) r.negativeDates.push(date);
      const gain = eventRewardGain(rewards.get(id) ?? null, today);
      state = {
        ...state,
        bond: state.bond + gain.bond,
        trickProgress: {
          ...state.trickProgress,
          [TRICK]: (state.trickProgress[TRICK] ?? 0) + gain.trickProgress,
        },
      };
    }

    // Day 1 is adoption day, so day N means N - 1 full days together.
    const stage = growthStage(day - 1, state.bond, growthConfig);
    if (stage !== 'puppy' && r.adolescentDay === null) r.adolescentDay = day;
    if (stage === 'adult' && r.adultDay === null) r.adultDay = day;
  }
  r.finalBalance = balance(state.ledger);
  return r;
}

/** Acceptance 5: a mopey pup at the floor is content after one goal day of basic care. */
function inactiveRecovers(): boolean {
  let state: CareState = {
    today: START,
    needs: { fullness: 25, cleanliness: 25, playfulness: 25, energy: 100 },
    bond: 0,
    ledger: [credit(START, dailyEarnings(1, earningsConfig), { kind: 'movement' })],
    treatsToday: 0,
    toys: [],
    trickProgress: {},
  };
  for (const action of [{ type: 'meal' }, { type: 'meal' }, { type: 'brushing' }] as const) {
    const out = applyCare(state, action, careConfig);
    if (!out.ok) return false;
    state = out.state;
  }
  return mood(state.needs, needsConfig) !== 'mopey';
}

function maxNegativesIn7Days(dates: readonly string[]): number {
  let max = 0;
  for (const start of dates) {
    max = Math.max(
      max,
      dates.filter((d) => daysBetween(start, d) >= 0 && daysBetween(start, d) < 7).length,
    );
  }
  return max;
}

const results = (Object.keys(PLAYERS) as PlayerName[]).map((p, i) => simulate(p, 1000 + i));

console.log(`Kithe economy sim: ${DAYS} days, economy v${economy.version}`);
console.table(
  results.map((r) => ({
    player: r.player,
    earnedPerDay: Math.round(r.totalEarned / DAYS),
    basicCarePerDay: Math.round(r.basicCareSpend / DAYS),
    balance: r.finalBalance,
    thriving: r.moods.thriving,
    content: r.moods.content,
    mopey: r.moods.mopey,
    adolescent: r.adolescentDay ?? '-',
    adult: r.adultDay ?? '-',
    toys: r.toysBought,
    sitLearned: r.trickLearnedDay ?? '-',
    negatives: r.negativeDates.length,
  })),
);

const avg = results.find((r) => r.player === 'average')!;
const cheapestToy = careConfig.toys[toyIds[0]!]!.price;
const midToy = careConfig.toys[toyIds[Math.floor(toyIds.length / 2)]!]!.price;
const avgNetPerDay = (avg.totalEarned - avg.basicCareSpend) / DAYS;

const checks: [string, boolean, string][] = [
  [
    'average player reaches adolescent on day 14 to 16',
    avg.adolescentDay !== null && avg.adolescentDay >= 14 && avg.adolescentDay <= 16,
    `day ${avg.adolescentDay}`,
  ],
  [
    'average player reaches adult in 6 to 7 weeks',
    avg.adultDay !== null && avg.adultDay >= 42 && avg.adultDay <= 49,
    `day ${avg.adultDay}`,
  ],
  [
    'average player can afford a new mid-priced toy about every 5 days',
    avgNetPerDay * 5 >= midToy,
    `${Math.round(avgNetPerDay * 5)} Pawprints of headroom per 5 days vs ${midToy}`,
  ],
  [
    'nobody earns more than the daily cap',
    results.every((r) => r.maxEarnedInADay <= earningsConfig.dailyCap),
    `max ${Math.max(...results.map((r) => r.maxEarnedInADay))}`,
  ],
  [
    'needs never fall below the safety floor',
    results.every((r) => r.minNeed >= needsConfig.floor),
    `min ${Math.min(...results.map((r) => r.minNeed))}`,
  ],
  ['a mopey pup recovers after one goal day of basic care', inactiveRecovers(), ''],
  [
    'at most one negative event in any 7 days',
    results.every((r) => maxNegativesIn7Days(r.negativeDates) <= 1),
    `max ${Math.max(...results.map((r) => maxNegativesIn7Days(r.negativeDates)))}`,
  ],
  [
    'the cheapest toy is affordable on a single goal day',
    dailyEarnings(1, earningsConfig) - 2 * careConfig.prices.meal >= cheapestToy,
    `${cheapestToy} Pawprints`,
  ],
];

let failed = 0;
for (const [name, pass, detail] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`);
  if (!pass) failed += 1;
}
if (failed > 0) {
  console.error(`\n${failed} balancing target(s) failed.`);
  process.exit(1);
}
