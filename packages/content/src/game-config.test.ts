import { act, adopt, advanceToNow, planNotifications, syncMovement, view } from '@kithe/core';
import { describe, expect, it } from 'vitest';

import { findBannedPhrases } from './bannedPhrases';
import { breeds, gameConfig } from './core-config';
import { bannedPhrases, copy } from './parsed';

describe('real content through the game engine', () => {
  it('runs 30 days of play without errors and every diary entry passes the banned list', () => {
    let s = adopt(
      {
        name: 'Biscuit',
        breed: breeds[0]!.id,
        timeZone: 'America/New_York',
        nowMs: Date.parse('2026-10-14T16:00:00Z'),
        seed: 1,
        startingGoal: { steps: 5000, exerciseMinutes: 30 },
      },
      gameConfig,
    );
    for (let d = 1; d <= 30; d += 1) {
      const nowMs = Date.parse('2026-10-14T16:00:00Z') + d * 86_400_000;
      s = advanceToNow(s, nowMs, gameConfig);
      const today = s.days.at(-1)!.date;
      s = syncMovement(
        s,
        { [today]: { steps: 4000 + d * 100, exerciseMinutes: 0, wheelchairPushes: 0 } },
        gameConfig,
      );
      for (const action of [{ type: 'meal' }, { type: 'meal' }, { type: 'brushing' }] as const) {
        const out = act(s, action, gameConfig);
        if (out.ok) s = out.state;
      }
    }
    expect(s.daysTogether).toBe(30);
    expect(view(s, gameConfig).stage).toBe('adolescent');
    expect(s.diary.length).toBe(31);
    for (const entry of s.diary) {
      expect(findBannedPhrases(entry.text, bannedPhrases.phrases), entry.text).toEqual([]);
      expect(entry.text).not.toMatch(/[{}]/);
    }
  });
});

describe('daily notifications from real content', () => {
  it('fills the pup name and passes the banned list for 60 days', () => {
    const s = adopt(
      {
        name: 'Biscuit',
        breed: breeds[0]!.id,
        timeZone: 'UTC',
        nowMs: Date.parse('2026-10-14T12:00:00Z'),
        seed: 9,
        startingGoal: { steps: 5000, exerciseMinutes: 30 },
      },
      gameConfig,
    );
    const plan = planNotifications(s, copy.notifications, s.clock.lastDay, 60);
    expect(plan[0]!.text).toBe('Biscuit wrote something overnight.');
    for (const { text } of plan) {
      expect(text).not.toMatch(/[{}]/);
      expect(findBannedPhrases(text, bannedPhrases.phrases), text).toEqual([]);
    }
  });
});
