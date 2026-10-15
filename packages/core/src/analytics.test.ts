import { describe, expect, it } from 'vitest';

import { buildEvent } from './analytics';

const CTX = { installDay: 6.7, platform: 'android' };

describe('buildEvent', () => {
  it('keeps allowlisted properties and adds install day and platform', () => {
    expect(buildEvent('care_action', { action: 'meal' }, CTX)).toEqual({
      event: 'care_action',
      properties: { action: 'meal', install_day: 6, platform: 'android' },
    });
  });

  it('drops health data, goals, names, and anything else not on the list (invariant 3)', () => {
    const leaky = {
      action: 'meal',
      steps: 8000,
      exerciseMinutes: 30,
      wheelchairPushes: 5,
      goal: { steps: 6000 },
      progress: 1.3,
      petName: 'Biscuit',
      email: 'someone@example.com',
      access: { steps: true },
    };
    const { properties } = buildEvent('care_action', leaky, CTX);
    expect(Object.keys(properties).sort()).toEqual(['action', 'install_day', 'platform']);
    for (const event of [
      'app_opened',
      'diary_opened',
      'recap_shared',
      'notification_opened',
    ] as const) {
      expect(Object.keys(buildEvent(event, leaky, CTX).properties).sort()).toEqual([
        'install_day',
        'platform',
      ]);
    }
  });

  it('rejects non-primitive values even for allowed keys', () => {
    const { properties } = buildEvent('care_action', { action: { steps: 9000 } }, CTX);
    expect(properties).not.toHaveProperty('action');
  });

  it('truncates long strings such as error messages', () => {
    const { properties } = buildEvent('$exception', { $exception_message: 'x'.repeat(2000) }, CTX);
    expect(String(properties.$exception_message).length).toBe(500);
  });
});
