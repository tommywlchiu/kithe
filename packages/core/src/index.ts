export { applyCare, trickLearned } from './care';
export type { CareAction, CareConfig, CareOutcome, CareState, OwnedToy } from './care';
export { clamp } from './clamp';
export {
  dailyEarnings,
  dailyProgress,
  firstDayGoal,
  startingGoal,
  weeklyGoalAdjust,
} from './earnings';
export type {
  DayCounts,
  EarningsConfig,
  GoalConfig,
  MovementGoal,
  StartingGoalInput,
} from './earnings';
export { eventRewardGain, growthStage, pickTemplate, scheduleEvents } from './life';
export type {
  DayFacts,
  DiaryLine,
  EventDef,
  EventHistory,
  EventReward,
  GrowthConfig,
  Stage,
} from './life';
export { combineSourceRecords, lastNDates } from './movement';
export type {
  DayMovement,
  DayTotal,
  DayWindow,
  IsoDate,
  MovementAccess,
  MovementAvailability,
  MovementSource,
  SourceRecord,
} from './movement';
export { decayNeeds, mood, raiseNeed } from './needs';
export type { Mood, Needs, NeedsConfig } from './needs';
export {
  addDays,
  daysBetween,
  isValidTimeZone,
  localDate,
  MAX_CATCH_UP_DAYS,
  rolloverDay,
  seededRandom,
} from './time';
export type { Clock } from './time';
export { balance, credit, debit } from './wallet';
export type { CreditReason, DebitReason, LedgerEntry } from './wallet';
