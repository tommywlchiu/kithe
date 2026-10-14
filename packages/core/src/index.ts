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
export { balance, credit, debit } from './wallet';
export type { CreditReason, DebitReason, LedgerEntry } from './wallet';
