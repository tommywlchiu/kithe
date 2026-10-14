import { describe, expect, it } from 'vitest';

import {
  type DayFacts,
  type DiaryLine,
  eventRewardGain,
  type EventDef,
  growthStage,
  type GrowthConfig,
  pickTemplate,
  scheduleEvents,
} from './life';
import {
  addDays,
  daysBetween,
  isValidTimeZone,
  localDate,
  rolloverDay,
  seededRandom,
} from './time';

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

  it('processes at most the last 7 days and counts the rest as skipped', () => {
    const out = rolloverDay(clock, at('2026-11-12T18:00:00Z'));
    expect(out.newDays).toEqual([
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
    ]);
    expect(out.skippedDays).toBe(23);
  });

  it('knows which time zones the device supports', () => {
    expect(isValidTimeZone('America/Los_Angeles')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus_Mons')).toBe(false);
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

const ids = (out: { fired: string[] }) => out.fired;

describe('scheduleEvents', () => {
  it('fires one-time events on their day and records them so they never repeat', () => {
    const first = scheduleEvents(day({ dayNumber: 2 }), EVENTS, { firedIds: [] }, never);
    expect(ids(first)).toEqual(['teething']);
    expect(first.history.firedIds).toEqual(['teething']);
    expect(first.history.lastNegativeDate).toBe('2026-10-14');
    expect(
      ids(scheduleEvents(day({ date: '2026-10-15', dayNumber: 3 }), EVENTS, first.history, never)),
    ).toEqual([]);
  });

  it('catches up a missed one-time event on a later day', () => {
    expect(ids(scheduleEvents(day({ dayNumber: 9 }), EVENTS, { firedIds: [] }, never))).toEqual([
      'firstVetCheckup',
      'teething',
    ]);
  });

  it('allows at most one negative event in any 7 days', () => {
    const history = { firedIds: ONE_TIME_DONE, lastNegativeDate: '2026-10-10' };
    expect(
      ids(
        scheduleEvents(day({ date: '2026-10-14', treatsOverLimit: true }), EVENTS, history, never),
      ),
    ).toEqual([]);
    expect(
      ids(
        scheduleEvents(day({ date: '2026-10-17', treatsOverLimit: true }), EVENTS, history, never),
      ),
    ).toEqual(['upsetTummy']);
  });

  it('never lets two negatives fire on the same day', () => {
    expect(
      ids(
        scheduleEvents(
          day({ dayNumber: 2, treatsOverLimit: true }),
          EVENTS,
          { firedIds: [] },
          never,
        ),
      ),
    ).toEqual(['teething']);
  });

  it('starts nothing during Rest Mode', () => {
    const facts = day({
      dayNumber: 2,
      restMode: true,
      goalBeatYesterday: true,
      treatsOverLimit: true,
    });
    expect(ids(scheduleEvents(facts, EVENTS, { firedIds: [] }, () => 0))).toEqual([]);
  });

  it('a second run on the same day only checks same-day triggers and repeats nothing', () => {
    const morning = scheduleEvents(
      day({ goalBeatYesterday: true }),
      EVENTS,
      { firedIds: ONE_TIME_DONE },
      never,
    );
    expect(ids(morning)).toEqual(['zoomies']);
    let rolls = 0;
    const counting = () => {
      rolls += 1;
      return 0;
    };
    const evening = scheduleEvents(
      day({ goalBeatYesterday: true, treatsOverLimit: true }),
      EVENTS,
      morning.history,
      counting,
    );
    expect(ids(evening)).toEqual(['upsetTummy']);
    expect(rolls).toBe(0);
    expect(evening.history.lastRun?.fired).toEqual(['zoomies', 'upsetTummy']);
  });

  it('fires the sock at about its daily chance', () => {
    const rng = seededRandom(42);
    let socks = 0;
    for (let i = 0; i < 7000; i += 1) {
      const facts = day({ date: addDays('2026-01-01', i) });
      if (
        ids(scheduleEvents(facts, EVENTS, { firedIds: ONE_TIME_DONE }, rng)).includes('stoleSock')
      )
        socks += 1;
    }
    expect(socks / 7000).toBeGreaterThan(0.12);
    expect(socks / 7000).toBeLessThan(0.16);
  });
});

describe('eventRewardGain', () => {
  it('gives bond and trick progress, but no bond while mopey', () => {
    expect(eventRewardGain({ bond: 5 }, 'content')).toEqual({ bond: 5, trickProgress: 0 });
    expect(eventRewardGain({ bond: 5, trickProgress: 1 }, 'mopey')).toEqual({
      bond: 0,
      trickProgress: 1,
    });
    expect(eventRewardGain(null, 'thriving')).toEqual({ bond: 0, trickProgress: 0 });
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
  const TRAITS = ['playful', 'lazy', 'cuddly'];
  const lines: DiaryLine[] = [
    { id: 'sock', text: '{name} stole a sock.', tags: ['stoleSock', 'playful'] },
    { id: 'walk', text: 'A big walk today.', tags: ['goalHit'] },
    { id: 'first', text: 'My first night here.', tags: ['firstDay', 'cuddly'] },
    { id: 'nap', text: 'A rainy nap.', tags: ['lazy'] },
    { id: 'play', text: 'Tug time.', tags: ['playful'] },
  ];
  const ctx = (dayTags: string[], traits: string[]) => ({
    dayTags,
    traits,
    traitTags: TRAITS,
    petName: 'Biscuit',
  });

  it("prefers lines about today's events and fills in the name", () => {
    expect(pickTemplate(lines, ctx(['stoleSock'], []), [], never)).toEqual({
      id: 'sock',
      text: 'Biscuit stole a sock.',
    });
  });

  it('never picks a line about something that did not happen today', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const pick = pickTemplate(lines, ctx([], ['playful', 'cuddly']), [], seededRandom(seed));
      expect(['sock', 'walk', 'first']).not.toContain(pick.id);
    }
  });

  it('uses traits to choose among eligible lines', () => {
    expect(pickTemplate(lines, ctx([], ['lazy']), [], never).id).toBe('nap');
  });

  it('avoids the last 7 lines while other lines exist', () => {
    expect(pickTemplate(lines, ctx(['stoleSock'], []), ['sock'], never).id).not.toBe('sock');
  });

  it('repeats rather than failing when every eligible line was used recently', () => {
    expect(pickTemplate([lines[3]!], ctx([], []), ['nap'], never).id).toBe('nap');
  });
});
