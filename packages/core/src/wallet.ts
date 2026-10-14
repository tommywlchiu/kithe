import type { IsoDate } from './movement';

/**
 * The only ways Pawprints enter the wallet (invariant 1). There is deliberately no
 * purchase, ad, or Stars source in this union, so code that tries to add one fails to compile.
 */
export type CreditReason =
  { kind: 'movement' } | { kind: 'starterKit' } | { kind: 'eventReward'; eventId: string };

export type DebitReason = { kind: 'care'; action: string };

export type LedgerEntry =
  | { date: IsoDate; amount: number; reason: CreditReason }
  | { date: IsoDate; amount: number; reason: DebitReason };

/**
 * Balance is always derived from the append-only ledger, never stored. The direction comes
 * from the reason, not the stored sign, so a malformed entry (a rehydrated or hand-built
 * object) can never turn a care spend into income.
 */
export function balance(ledger: readonly LedgerEntry[]): number {
  return ledger.reduce(
    (sum, entry) => sum + (entry.reason.kind === 'care' ? -1 : 1) * Math.abs(entry.amount),
    0,
  );
}

export function credit(date: IsoDate, amount: number, reason: CreditReason): LedgerEntry {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new RangeError(`credit must be a whole number >= 0, got ${amount}`);
  }
  return { date, amount, reason };
}

export function debit(date: IsoDate, amount: number, action: string): LedgerEntry {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new RangeError(`debit must be a whole number > 0, got ${amount}`);
  }
  return { date, amount: -amount, reason: { kind: 'care', action } };
}
