import { businessDateOf, sum, type Decimal } from '@pos/domain';

import { instant, integer, text } from '../transform/values.js';

import { addTo, type Facts } from './facts.js';
import { sourceRecords } from './source-records.js';
import { methodOf, rs, signedEntries, type SignedEntry } from './source-values.js';

import type { LegacyData } from '../legacy/reader.js';

const total = (values: readonly Decimal[]): string => sum(values).toFixed(2);
const raised = (entries: readonly SignedEntry[]) =>
  total(entries.filter((e) => e.signed.greaterThan(0)).map((e) => e.signed));
const lowered = (entries: readonly SignedEntry[]) =>
  total(entries.filter((e) => e.signed.lessThan(0)).map((e) => e.signed.negated()));

function groups(data: LegacyData, vendorEntries: readonly SignedEntry[], timeZone: string) {
  const salesByMonth = new Map<string, string>();
  const billPaymentsByMethod = new Map<string, string>();
  const vendorPaymentsByMethod = new Map<string, string>();
  for (const order of data.orders) {
    const at = instant(order.createdAt);
    const month = at === null ? 'no date' : businessDateOf(at, timeZone).slice(0, 7);
    addTo(salesByMonth, month, rs(order.finalAmount));
  }
  for (const payment of data.orderPayments) {
    addTo(billPaymentsByMethod, methodOf(payment.paymentMethod), rs(payment.amount));
  }
  for (const entry of vendorEntries.filter((e) => e.signed.lessThan(0))) {
    addTo(vendorPaymentsByMethod, methodOf(entry.method), entry.signed.negated());
  }
  return { salesByMonth, billPaymentsByMethod, vendorPaymentsByMethod };
}

/**
 * The old side of the validation, from the raw rows read in the run's snapshot and independent of the
 * transforms: if a transform is wrong, the two sides disagree.
 */
export function sourceFacts(data: LegacyData, timeZone: string): Facts {
  const customerEntries = signedEntries(data.customerTransactions, 'debit');
  const vendorEntries = signedEntries(data.vendorTransactions, 'purchase');
  const { orders, orderItems: items, products } = data;
  const stock = (row: LegacyData['products'][number]): number => integer(row.stock) ?? 0;
  return {
    counts: {
      lines: items.length,
      linesWithProduct: items.filter((item) => text(item.productId) !== null).length,
      // greaterThan, not isPositive: decimal.js counts zero as positive.
      refunds: orders.filter((order) => rs(order.refundedAmount).greaterThan(0)).length,
      refundLines: items.filter((item) => (integer(item.refundedQuantity) ?? 0) > 0).length,
      stockMovements: products.filter((row) => stock(row) !== 0).length,
    },
    totals: {
      sales: total(orders.map((o) => rs(o.finalAmount))),
      subtotal: total(orders.map((o) => rs(o.totalAmount))),
      discounts: total([
        ...orders.map((o) => rs(o.discountAmount)),
        ...items.map((i) => rs(i.discount)),
      ]),
      productTax: total(orders.map((o) => rs(o.taxAmount))),
      billGst: total(orders.map((o) => rs(o.billGstAmount))),
      refunded: total(orders.map((o) => rs(o.refundedAmount))),
      billPayments: total(data.orderPayments.map((p) => rs(p.amount))),
      customerDebits: raised(customerEntries),
      customerCredits: lowered(customerEntries),
      vendorPurchases: raised(vendorEntries),
      vendorPayments: lowered(vendorEntries),
      stockPieces: String(products.reduce((pieces, row) => pieces + stock(row), 0)),
      stockAtPrice: total(products.map((row) => rs(row.price).times(stock(row)))),
      stockAtCost: total(
        products
          .filter((row) => text(row.cost) !== null)
          .map((row) => rs(row.cost).times(stock(row))),
      ),
    },
    groups: groups(data, vendorEntries, timeZone),
    records: sourceRecords(data, customerEntries, vendorEntries),
  };
}
