import { economy } from '@kithe/content';
import { clamp } from '@kithe/core';

// Placeholder body: proves the script -> core -> content import path end to end.
// The 90-day simulation over the four player types replaces this.
const summary = {
  economyVersion: economy.version,
  pawprintsAtGoal: economy.earnings.atGoal,
  dailyCap: economy.earnings.dailyCap,
  careItems: Object.keys(economy.care).length,
  goalClampCheck: clamp(500, economy.goal.minSteps, economy.goal.maxSteps),
};

console.log('economy-sim smoke');
console.log(JSON.stringify(summary, null, 2));
