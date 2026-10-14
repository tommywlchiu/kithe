import { describe, expect, it } from 'vitest';

import {
  type DayFacts,
  type DiaryLine,
  type EventDef,
  growthStage,
  type GrowthConfig,
  pickTemplate,
  scheduleEvents,
} from './life';
import { addDays, daysBetween, localDate, rolloverDay, seededRandom } from './time';

const GROWTH: GrowthConfig = { adolescent: { days: 14, bond: 20 }, adult: { days: 42, bond: 60 } };

// Mirrors @kithe/content events.json.
const EVENTS: EventDef[] = [
  { id: 'firstVetCheckup', negative: false, trigger: { type: 'onDay', day: 5 } },
  { id: 'teething', negative: true, trigger: { type: 'onDay', day: 2 } },
  { id: 'zoomies', negative: false, trigger: { type: 'afterGoalBeat' } },
  { id: 'stoleSock', negative: false, trigger: { type: 'randomDaily', chance: 0.14 } },
  { id: 'upsetTummy', negative: true, trigger: { type: 'treatsOverLimit' } },
];
const never = () => 0.99;
const ONE_TIME_DONE = ['firstVetCheckup', 'teething'];
const day = (over: Partial<DayFacts>): DayFacts => ({
  date: '2026-10-14',
  dayNumber: 10,
  restMode: false,
  goalBeatYesterday: false,
  treatsOverLimit: false,
  ...over,
});

describe('growthStage', () => {
  it('needs both days together and bond', () => {
    expect(growthStage(13, 100, GROWTH)).toBe('puppy');
    expect(growthStage(30, 19, GROWTH)).toBe('puppy');
    expect(growthStage(14, 20, GROWTH)).toBe('adolescent');
    expect(growthStage(42, 59, GROWTH)).toBe('adolescent');
    expect(growthStage(42, 60, GROWTH)).toBe('adult');
    expect(growthStage(400, 900, GROWTH)).toBe('adult');
  });
});

describe('dates', () => {
  it('reads the calendar day in the home time zone', () => {
    const ms = Date.parse('2026-10-14T05:30:00Z');
    expect(localDate(ms, 'America/Los_Angeles')).toBe('2026-10-13');
    expect(localDate(ms, 'Asia/Tokyo')).toBe('2026-10-14');
  });

  it('adds and counts days across month ends and DST changes', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
    expect(daysBetween('2026-11-01', '2026-11-02')).toBe(1);
  });
});

describe('rolloverDay', () => {
  const clock = { lastDay: '2026-10-13', homeTimeZone: 'America/Los_Angeles' };
  const at = (iso: string) => Date.parse(iso);

  it('returns every day that ended since the last check', () => {
    const out = rolloverDay(clock, at('2026-10-16T18:00:00Z'));
    expect(out.newDays).toEqual(['2026-10-14', '2026-10-15', '2026-10-16']);
    expect(out.clock.lastDay).toBe('2026-10-16');
  });

  it('does nothing on the same day, and never re-credits after the clock goes back', () => {
    expect(rolloverDay(clock, at('2026-10-13T20:00:00Z')).newDays).toEqual([]);
    const moved = rolloverDay({ ...clock, lastDay: '2026-10-20' }, at('2026-10-16T18:00:00Z'));
    expect(moved.newDays).toEqual([]);
    expect(moved.clock.lastDay).toBe('2026-10-20');
  });

  it('applies a time zone change only from the next day', () => {
    const traveling = { ...clock, pendingTimeZone: 'Asia/Tokyo' };
    // 06:00Z Oct 14 is still Oct 13 in Los Angeles: no new day yet, zone unchanged.
    const sameDay = rolloverDay(traveling, at('2026-10-14T06:00:00Z'));
    expect(sameDay.newDays).toEqual([]);
    expect(sameDay.clock.homeTimeZone).toBe('America/Los_Angeles');
    const next = rolloverDay(traveling, at('2026-10-14T18:00:00Z'));
    expect(next.newDays).toEqual(['2026-10-14']);
    expect(next.clock).toEqual({ lastDay: '2026-10-14', homeTimeZone: 'Asia/Tokyo' });
  });
});

describe('scheduleEvents', () => {
  it('fires one-time events on their day and only once', () => {
    expect(scheduleEvents(day({ dayNumber: 2 }), EVENTS, { firedIds: [] }, never)).toEqual([
      'teething',
    ]);
    expect(
      scheduleEvents(day({ dayNumber: 3 }), EVENTS, { firedIds: ['teething'] }, never),
    ).toEqual([]);
  });

  it('catches up a missed one-time event on a later day', () => {
    expect(scheduleEvents(day({ dayNumber: 9 }), EVENTS, { firedIds: [] }, never)).toEqual([
      'firstVetCheckup',
      'teething',
    ]);
  });

  it('allows at most one negative event in any 7 days', () => {
    const history = { firedIds: ONE_TIME_DONE, lastNegativeDate: '2026-10-10' };
    expect(
      scheduleEvents(day({ date: '2026-10-14', treatsOverLimit: true }), EVENTS, history, never),
    ).toEqual([]);
    expect(
      scheduleEvents(day({ date: '2026-10-17', treatsOverLimit: true }), EVENTS, history, never),
    ).toEqual(['upsetTummy']);
  });

  it('never lets two negatives fire on the same day', () => {
    const fired = scheduleEvents(
      day({ dayNumber: 2, treatsOverLimit: true }),
      EVENTS,
      { firedIds: [] },
      never,
    );
    expect(fired).toEqual(['teething']);
  });

  it('starts nothing during Rest Mode', () => {
    expect(
      scheduleEvents(
        day({ dayNumber: 2, restMode: true, goalBeatYesterday: true, treatsOverLimit: true }),
        EVENTS,
        { firedIds: [] },
        () => 0,
      ),
    ).toEqual([]);
  });

  it('fires zoomies after a goal-beating day and the sock at about its daily chance', () => {
    expect(
      scheduleEvents(day({ goalBeatYesterday: true }), EVENTS, { firedIds: ONE_TIME_DONE }, never),
    ).toEqual(['zoomies']);
    const rng = seededRandom(42);
    let socks = 0;
    for (let i = 0; i < 7000; i += 1) {
      if (scheduleEvents(day({}), EVENTS, { firedIds: ONE_TIME_DONE }, rng).includes('stoleSock'))
        socks += 1;
    }
    expect(socks / 7000).toBeGreaterThan(0.12);
    expect(socks / 7000).toBeLessThan(0.16);
  });
});

describe('seededRandom', () => {
  it('replays the same sequence from the same seed', () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('pickTemplate', () => {
  const lines: DiaryLine[] = [
    { id: 'sock', text: '{name} stole a sock.', tags: ['stoleSock', 'playful'] },
    { id: 'walk', text: 'A big walk today.', tags: ['goalHit'] },
    { id: 'nap', text: 'A rainy nap.', tags: ['cozyWeek', 'lazy'] },
    { id: 'play', text: 'Tug time.', tags: ['playful'] },
  ];

  it("prefers lines about today's events and fills in the name", () => {
    expect(
      pickTemplate(lines, { dayTags: ['stoleSock'], traits: [], petName: 'Biscuit' }, [], never),
    ).toEqual({ id: 'sock', text: 'Biscuit stole a sock.' });
  });

  it('uses traits to break ties when nothing happened', () => {
    expect(
      pickTemplate(lines, { dayTags: [], traits: ['lazy'], petName: 'Biscuit' }, [], never).id,
    ).toBe('nap');
  });

  it('avoids the last 7 lines while other lines exist', () => {
    const pick = pickTemplate(
      lines,
      { dayTags: ['stoleSock'], traits: [], petName: 'Biscuit' },
      ['sock'],
      never,
    );
    expect(pick.id).not.toBe('sock');
  });

  it('repeats rather than failing when every line was used recently', () => {
    const only = [lines[0]!];
    expect(pickTemplate(only, { dayTags: [], traits: [], petName: 'B' }, ['sock'], never).id).toBe(
      'sock',
    );
  });
});
