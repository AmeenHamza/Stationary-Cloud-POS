import { parseBillNumber } from '@pos/domain';

import type { LedgerPlan } from './ledgers.js';
import type { OrderPlan } from './orders.js';
import type { CustomerEntryType } from '@pos/contracts';

export interface CounterPlan {
  businessDate: string;
  lastValue: number;
}

/**
 * One counter per date: the highest migrated `ORD-YYYYMMDD-NNN` of that date, so the first new bill of
 * the cutover day continues after the old ones (MIG-05). Old numbers in another format are skipped.
 */
export function planCounters(orders: readonly OrderPlan[]): CounterPlan[] {
  const highest = new Map<string, number>();
  for (const order of orders) {
    const parsed = parseBillNumber(order.billNumber);
    if (parsed !== null && parsed.businessDate === order.businessDate) {
      highest.set(
        parsed.businessDate,
        Math.max(highest.get(parsed.businessDate) ?? 0, parsed.sequence),
      );
    }
  }
  return [...highest]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([businessDate, lastValue]) => ({ businessDate, lastValue }));
}

/**
 * The old app kept no refund date. A refunded Udhaar bill's khata refund entry has one, so its refund
 * takes that date; the others keep their bill's date (Q43).
 */
export function datedRefunds(
  orders: readonly OrderPlan[],
  entries: readonly LedgerPlan<CustomerEntryType>[],
): OrderPlan[] {
  const byRefund = new Map(
    entries.flatMap((entry) => (entry.refundId === null ? [] : [[entry.refundId, entry] as const])),
  );
  return orders.map((order) => {
    const entry = order.refund === null ? undefined : byRefund.get(order.refund.id);
    if (order.refund === null || entry === undefined) {
      return order;
    }
    const refund = {
      ...order.refund,
      createdAt: entry.createdAt,
      businessDate: entry.businessDate,
    };
    return { ...order, refund };
  });
}
