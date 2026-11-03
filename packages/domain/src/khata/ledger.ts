import { Decimal } from '../money/decimal.js';
import { money, toMoneyString } from '../money/money.js';

/**
 * Khata (credit ledger) amounts (DATABASE.md §4.8). Every entry stores a signed amount: + raises the
 * balance (a credit sale, manual Udhaar, a vendor purchase), − lowers it (a payment, a refund credit).
 */
export function ledgerDelta(amount: Decimal | string, raisesBalance: boolean): Decimal {
  const value = money(amount);
  return raisesBalance ? value : value.negated();
}

/**
 * A balance for display (Q25): customers `owed` (they owe the shop) or `advance` (the shop holds
 * their money); vendors `owed` means the shop owes them. `magnitude` is the absolute amount.
 */
export function balanceState(balance: Decimal | string): {
  state: 'owed' | 'advance' | 'settled';
  magnitude: string;
} {
  const value = money(balance);
  const state = value.isZero() ? 'settled' : value.isNegative() ? 'advance' : 'owed';
  return { state, magnitude: toMoneyString(new Decimal(value.abs())) };
}
