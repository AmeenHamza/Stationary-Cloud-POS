import { ZERO } from '@pos/domain';

import { paymentMethodOf } from '../transform/payment-method.js';
import { integer, text } from '../transform/values.js';

import { balancesOf, ms, rs, type SignedEntry } from './source-values.js';

import type { Facts, RecordFields } from './facts.js';
import type { LegacyData } from '../legacy/reader.js';

function byId<T extends { id: string | null }>(
  rows: readonly T[],
  fields: (row: T) => RecordFields,
): Map<string, RecordFields> {
  return new Map(rows.map((row) => [row.id ?? '', fields(row)]));
}

/** Categories whose name repeats an earlier one (ignoring case) are merged into it, not migrated. */
function firstOfEachName(rows: LegacyData['categories']): LegacyData['categories'] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = text(row.name)?.toLowerCase() ?? `#${row.id ?? ''}`;
    const first = !seen.has(key);
    seen.add(key);
    return first;
  });
}

const entryRecords = (entries: readonly SignedEntry[]): Map<string, RecordFields> =>
  new Map(entries.map((e) => [e.id, { amount: e.signed.toFixed(2), createdAt: ms(e.createdAt) }]));

/** Per old record: the values the new record must carry (numbers, links and times; not names). */
export function sourceRecords(
  data: LegacyData,
  customerEntries: readonly SignedEntry[],
  vendorEntries: readonly SignedEntry[],
): Facts['records'] {
  const owed = balancesOf(customerEntries);
  const owing = balancesOf(vendorEntries);
  return {
    categories: byId(firstOfEachName(data.categories), (c) => ({ createdAt: ms(c.createdAt) })),
    products: byId(data.products, (p) => ({
      stock: String(integer(p.stock) ?? 0),
      price: rs(p.price).toFixed(2),
      cost: text(p.cost) === null ? 'none' : rs(p.cost).toFixed(2),
      createdAt: ms(p.createdAt),
    })),
    customers: byId(data.customers, (c) => ({
      balance: (owed.get(c.id ?? '') ?? ZERO).toFixed(2),
      createdAt: ms(c.createdAt),
    })),
    vendors: byId(data.vendors, (v) => ({
      balance: (owing.get(v.id ?? '') ?? ZERO).toFixed(2),
      createdAt: ms(v.createdAt),
    })),
    orders: byId(data.orders, (o) => ({
      billNumber: text(o.orderNumber),
      total: rs(o.finalAmount).toFixed(2),
      refunded: rs(o.refundedAmount).toFixed(2),
      method: paymentMethodOf(o.paymentMethod) ?? 'unknown',
      customer: text(o.customerId) ?? 'none',
      createdAt: ms(o.createdAt),
    })),
    customerEntries: entryRecords(customerEntries),
    vendorEntries: entryRecords(vendorEntries),
  };
}
