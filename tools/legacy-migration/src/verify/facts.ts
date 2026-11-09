/**
 * What both sides must agree on after a run (MAPPING.md §9.3, VALIDATION.md). The old side is computed
 * from the raw old rows, independently of the transforms; the new side from SQL on the new database.
 */
export const COUNT_KEYS = [
  'lines',
  'linesWithProduct',
  'refunds',
  'refundLines',
  'stockMovements',
] as const;

export const TOTAL_KEYS = [
  'sales',
  'subtotal',
  'discounts',
  'productTax',
  'billGst',
  'refunded',
  'billPayments',
  'customerDebits',
  'customerCredits',
  'vendorPurchases',
  'vendorPayments',
  'stockPieces',
  'stockAtPrice',
  'stockAtCost',
] as const;

export const GROUP_KEYS = [
  'salesByMonth',
  'billPaymentsByMethod',
  'vendorPaymentsByMethod',
] as const;

export const RECORD_KEYS = [
  'categories',
  'products',
  'customers',
  'vendors',
  'orders',
  'customerEntries',
  'vendorEntries',
] as const;

export type CountKey = (typeof COUNT_KEYS)[number];
export type TotalKey = (typeof TOTAL_KEYS)[number];
export type GroupKey = (typeof GROUP_KEYS)[number];
export type RecordKey = (typeof RECORD_KEYS)[number];

/** One record's compared fields (numbers as exact text); a null old value is not compared. */
export type RecordFields = Readonly<Record<string, string | null>>;

export interface Facts {
  counts: Record<CountKey, number>;
  /** Money with 2 decimals; `stockPieces` as a whole number. */
  totals: Record<TotalKey, string>;
  groups: Record<GroupKey, Map<string, string>>;
  /** Per old id. Names are not compared (a long one is cut on purpose); numbers, links and times are. */
  records: Record<RecordKey, Map<string, RecordFields>>;
}

/** Adds `amount` to `key` in a map of exact money strings. */
export function addTo(
  map: Map<string, string>,
  key: string,
  amount: { plus: (other: string) => { toFixed: (digits: number) => string } },
): void {
  map.set(key, amount.plus(map.get(key) ?? '0').toFixed(2));
}
