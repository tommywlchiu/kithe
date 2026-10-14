// Pure form validation for the waitlist. Mirrors the database check constraints so a
// visitor sees a friendly message before the insert, not a database error after it.

export const MESSAGES = {
  email: "That email doesn't look quite right.",
  phone: 'Pick your phone so we send the right invite.',
  age: "Kithe's beta is for adults 18 and up.",
};

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const REF = /^[a-z0-9_-]{1,32}$/;
export const REASONS = ['lease', 'cost', 'time', 'allergies', 'other'];

/**
 * @param {{ email: unknown, phone: unknown, isAdult: unknown }} input
 * @returns {{ ok: true, value: { email: string, phone: 'iphone' | 'android', isAdult: true } }
 *   | { ok: false, errors: Partial<Record<'email' | 'phone' | 'age', string>> }}
 */
export function validateSignup(input) {
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const errors = {};
  if (email.length < 3 || email.length > 254 || !EMAIL.test(email)) errors.email = MESSAGES.email;
  if (input.phone !== 'iphone' && input.phone !== 'android') errors.phone = MESSAGES.phone;
  if (input.isAdult !== true) errors.age = MESSAGES.age;
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { email, phone: input.phone, isAdult: true } };
}

/** Normalizes a `?ref=` tag to what the database accepts, or null. */
export function sanitizeRef(raw) {
  if (typeof raw !== 'string') return null;
  const ref = raw.trim().toLowerCase();
  return REF.test(ref) ? ref : null;
}

/** RFC 4122 v4 id; falls back to getRandomValues where randomUUID is missing (iOS before 15.4). */
export function uuidV4(cryptoImpl = globalThis.crypto) {
  if (typeof cryptoImpl.randomUUID === 'function') return cryptoImpl.randomUUID();
  const b = cryptoImpl.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function isReason(value) {
  return REASONS.includes(value);
}
