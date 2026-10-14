import { describe, expect, it } from 'vitest';

import { isReason, MESSAGES, sanitizeRef, uuidV4, validateSignup } from './validate';

const good = { email: ' Tommy@Example.com ', phone: 'android', isAdult: true };

describe('validateSignup', () => {
  it('accepts a complete signup and normalizes the email', () => {
    expect(validateSignup(good)).toEqual({
      ok: true,
      value: { email: 'tommy@example.com', phone: 'android', isAdult: true },
    });
  });

  it('returns every error at once with the landing-page copy', () => {
    expect(validateSignup({ email: 'nope', phone: '', isAdult: false })).toEqual({
      ok: false,
      errors: { email: MESSAGES.email, phone: MESSAGES.phone, age: MESSAGES.age },
    });
  });

  it.each(['', 'a@b', 'a b@c.com', '@example.com', `${'a'.repeat(250)}@x.com`])(
    'rejects the email %j',
    (email) => {
      expect(validateSignup({ ...good, email }).ok).toBe(false);
    },
  );

  it('requires the box to be ticked, not just truthy', () => {
    expect(validateSignup({ ...good, isAdult: 'on' }).ok).toBe(false);
  });
});

describe('sanitizeRef', () => {
  it('keeps simple channel tags, lowercased', () => {
    expect(sanitizeRef('TikTok')).toBe('tiktok');
    expect(sanitizeRef('reddit_cozy-games')).toBe('reddit_cozy-games');
  });

  it('drops anything the database would reject', () => {
    expect(sanitizeRef('<script>')).toBeNull();
    expect(sanitizeRef('a'.repeat(33))).toBeNull();
    expect(sanitizeRef(null)).toBeNull();
  });
});

describe('isReason', () => {
  it('accepts only the five thank-you options', () => {
    expect(isReason('lease')).toBe(true);
    expect(isReason('drop table')).toBe(false);
  });
});

describe('uuidV4', () => {
  const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it('uses randomUUID when the browser has it', () => {
    expect(uuidV4()).toMatch(V4);
  });

  it('builds a valid v4 id without randomUUID', () => {
    const legacy = { getRandomValues: (a) => globalThis.crypto.getRandomValues(a) };
    expect(uuidV4(legacy)).toMatch(V4);
  });
});
