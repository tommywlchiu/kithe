import { templateText } from './schema/diary';
import { describe, expect, it } from 'vitest';

import {
  bannedPhrases,
  copy,
  diary,
  diarySchema,
  economy,
  eventIds,
  events,
  findBannedPhrases,
  items,
  traitIds,
} from './index';

const phrases = bannedPhrases.phrases;
const notificationLines = [copy.notifications.dayOne, ...copy.notifications.daily];

describe('banned-phrase matcher', () => {
  it.each(phrases)('catches "%s" in a sentence, in any case', (phrase) => {
    const sentence = `Today the pup said ${phrase.toUpperCase()} by the window.`;
    expect(findBannedPhrases(sentence, phrases)).toContain(phrase);
  });

  it('matches whole words only', () => {
    const clean =
      'The diary sat by the pillow; we will keep thinking about the deadline and the dietitian.';
    expect(findBannedPhrases(clean, phrases)).toEqual([]);
    expect(findBannedPhrases('I could just die!', phrases)).toEqual(['die']);
  });

  it('lets a multi-word phrase span any whitespace', () => {
    expect(findBannedPhrases('{name} misses\n  you', phrases)).toContain('misses you');
  });
});

describe('invariants 4 and 5: copy passes the banned-phrase test', () => {
  it.each(diary.lines.map((l) => [l.id, l.text] as const))('diary %s is clean', (_, text) => {
    expect(findBannedPhrases(text, phrases)).toEqual([]);
  });

  it.each(notificationLines.map((l) => [l.id, l.text] as const))(
    'notification %s is clean',
    (_, text) => {
      expect(findBannedPhrases(text, phrases)).toEqual([]);
    },
  );

  it('keeps notifications to 12 words or fewer', () => {
    for (const line of notificationLines) {
      expect(line.text.split(/\s+/).length, line.id).toBeLessThanOrEqual(12);
    }
  });

  it('uses the day-1 line from the spec', () => {
    expect(copy.notifications.dayOne.text).toBe('{name} wrote something overnight.');
  });
});

describe('diary coverage', () => {
  it('has at least 60 lines with unique ids', () => {
    expect(diary.lines.length).toBeGreaterThanOrEqual(60);
    expect(new Set(diary.lines.map((l) => l.id)).size).toBe(diary.lines.length);
  });

  it.each([...traitIds, ...eventIds])('has at least 3 lines tagged %s', (tag) => {
    expect(diary.lines.filter((l) => l.tags.includes(tag)).length).toBeGreaterThanOrEqual(3);
  });

  it('rejects unknown tags and placeholders', () => {
    const line = { id: 'x1', text: 'A walk.', tags: ['goalHit'] };
    expect(() => diarySchema.parse({ version: '1', lines: [line] })).not.toThrow();
    expect(() =>
      diarySchema.parse({ version: '1', lines: [{ ...line, tags: ['grumpy'] }] }),
    ).toThrow();
    expect(() =>
      diarySchema.parse({ version: '1', lines: [{ ...line, text: 'Hi {owner}.' }] }),
    ).toThrow();
    expect(() => diarySchema.parse({ version: '1', lines: [line, line] })).toThrow();
  });
});

describe('events', () => {
  it('defines exactly the 5 Phase 0 events', () => {
    expect(events.events.map((e) => e.id).sort()).toEqual([...eventIds].sort());
  });

  it('points every response at a known care action or shop item', () => {
    const known = new Set([
      ...Object.keys(economy.care),
      ...Object.keys(economy.careEffects),
      ...Object.keys(items.items),
    ]);
    for (const e of events.events) {
      if (e.response !== null) expect(known.has(e.response), `${e.id} -> ${e.response}`).toBe(true);
    }
  });

  it('resolves every negative event on its own within 48 hours', () => {
    for (const e of events.events) {
      if (e.negative) expect(e.resolvesWithinHours, e.id).toBeLessThanOrEqual(48);
    }
  });
});

describe('items', () => {
  it('sells 3 toys priced 40 to 150 that wear out in 14 days', () => {
    const toys = Object.values(items.items).filter((i) => i.category === 'toy');
    expect(toys).toHaveLength(3);
    for (const toy of toys) {
      expect(toy.pricePawprints).toBeGreaterThanOrEqual(40);
      expect(toy.pricePawprints).toBeLessThanOrEqual(150);
      expect(toy.category === 'toy' && toy.wearDays).toBe(14);
    }
  });
});

describe('template placeholders', () => {
  it('rejects an unclosed placeholder', () => {
    expect(() => templateText.parse('{name wrote something overnight.')).toThrow();
    expect(templateText.parse('{name} wrote something overnight.')).toBeTruthy();
  });
});
