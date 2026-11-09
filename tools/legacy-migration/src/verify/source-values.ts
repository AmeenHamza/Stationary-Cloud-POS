import { ZERO, round2, type Decimal } from '@pos/domain';

import { paymentMethodOf } from '../transform/payment-method.js';
import { decimal, instant, text } from '../transform/values.js';

import type { LegacyData } from '../legacy/reader.js';

/** An old money value rounded to the paisa; empty reads as 0. */
export const rs = (value: string | null): Decimal => round2(decimal(value) ?? ZERO);

/** An old timestamp as the ISO text the new side is read back as; null when the old row has none. */
export const ms = (value: string | null): string | null => instant(value)?.toISOString() ?? null;

/** A payment method; an empty one counts as cash, the migration's default (Q42). */
export const methodOf = (value: string | null): string => paymentMethodOf(value) ?? 'CASH';

export interface SignedEntry {
  id: string;
  party: string;
  /** + raises what is owed, − lowers it. */
  signed: Decimal;
  method: string | null;
  createdAt: string | null;
}

type EntryRows = LegacyData['customerTransactions'] | LegacyData['vendorTransactions'];

/** Khata entries with their sign from the old type; zero amounts are not migrated. */
export function signedEntries(rows: EntryRows, raises: string): SignedEntry[] {
  return rows
    .map((row) => {
      const amount = rs(row.amount);
      const party = 'customerId' in row ? row.customerId : row.vendorId;
      return {
        id: row.id ?? '',
        party: text(party) ?? '',
        signed: text(row.type)?.toLowerCase() === raises ? amount : amount.negated(),
        method: row.paymentMethod,
        createdAt: row.createdAt,
      };
    })
    .filter((entry) => !entry.signed.isZero());
}

/** Σ signed entries per party: the balance the old app showed. */
export function balancesOf(entries: readonly SignedEntry[]): Map<string, Decimal> {
  const totals = new Map<string, Decimal>();
  for (const entry of entries) {
    totals.set(entry.party, (totals.get(entry.party) ?? ZERO).plus(entry.signed));
  }
  return totals;
}
