import { ZERO, businessDateOf } from '@pos/domain';

import { paymentMethodOf } from './payment-method.js';
import { capped, instant, money, text } from './values.js';

import type { Issues } from './issues.js';
import type { OrderPlan } from './orders.js';
import type { CustomerEntryType, PaymentMethod, VendorEntryType } from '@pos/contracts';
import type { Decimal } from '@pos/domain';

export interface LedgerPlan<T extends string> {
  legacyId: string;
  partyId: string;
  type: T;
  amount: Decimal;
  balanceAfter: Decimal;
  paymentMethod: PaymentMethod | null;
  note: string | null;
  orderId: string | null;
  refundId: string | null;
  businessDate: string;
  createdAt: Date;
}

/** Fields both old transaction tables share (customer_transactions, vendor_transactions). */
interface EntryRow {
  id: string | null;
  partyId: string | null;
  type: string | null;
  amount: string | null;
  description: string | null;
  paymentMethod: string | null;
  orderId?: string | null;
  createdAt: string | null;
}

interface Classified<T extends string> {
  type: T;
  sign: 1 | -1;
  paymentMethod?: PaymentMethod | null;
  orderId?: string | null;
  refundId?: string | null;
}

/** A payment's method: empty means cash (Q42); Udhaar or an unknown name blocks. */
function paidWith(row: EntryRow, issues: Issues, ref: string): PaymentMethod {
  const method = paymentMethodOf(row.paymentMethod);
  if (method === null) {
    issues.note('payment-method-defaulted', ref, 'payment without a method recorded as cash');
    return 'CASH';
  }
  if (method === undefined || method === 'UDHAAR') {
    issues.block('unknown-payment-method', ref, `payment method "${row.paymentMethod ?? ''}"`);
  }
  return method ?? 'CASH';
}

/**
 * Entries in time order per party with running balances (khata: Σ entries = balance, DATABASE.md
 * §4.8). Zero amounts are skipped; unknown types block the run.
 */
function planEntries<T extends string>(
  table: string,
  rows: readonly EntryRow[],
  partyIdOf: ReadonlyMap<string, string>,
  classify: (row: EntryRow, partyId: string, ref: string) => Classified<T> | null,
  context: { timeZone: string; issues: Issues },
): LedgerPlan<T>[] {
  const { issues } = context;
  const ordered = [...rows].sort(
    (a, b) =>
      (instant(a.createdAt)?.getTime() ?? 0) - (instant(b.createdAt)?.getTime() ?? 0) ||
      Number(a.id) - Number(b.id),
  );
  const balances = new Map<string, Decimal>();
  const plans: LedgerPlan<T>[] = [];
  for (const row of ordered) {
    const ref = `${table}#${row.id ?? ''}`;
    const partyId = partyIdOf.get(text(row.partyId) ?? '');
    const createdAt = instant(row.createdAt);
    const amount = money(row.amount, issues, ref, 'amount');
    if (partyId === undefined || createdAt === null || amount.isNegative()) {
      issues.block('missing-reference', ref, 'unknown party, no date, or a negative amount');
      continue;
    }
    if (amount.isZero()) {
      issues.note('zero-amount', ref, 'zero amount skipped');
      continue;
    }
    const kind = classify(row, partyId, ref);
    if (kind === null) {
      continue;
    }
    const signed = kind.sign === 1 ? amount : amount.negated();
    const balance = (balances.get(partyId) ?? ZERO).plus(signed);
    balances.set(partyId, balance);
    plans.push({
      legacyId: row.id ?? '',
      partyId,
      type: kind.type,
      amount: signed,
      balanceAfter: balance,
      paymentMethod: kind.paymentMethod ?? null,
      note: capped(row.description, 300, issues, ref, 'description'),
      orderId: kind.orderId ?? null,
      refundId: kind.refundId ?? null,
      businessDate: businessDateOf(createdAt, context.timeZone),
      createdAt,
    });
  }
  return plans;
}

/**
 * Customer khata: a debit raises what the customer owes; a credit or payment lowers it (MAPPING.md §5.4). A debit
 * for a migrated Udhaar bill becomes its credit sale and a credit for its refund a refund credit;
 * anything else is a manual credit or a payment.
 */
export function planCustomerEntries(
  rows: readonly EntryRow[],
  customerIdOf: ReadonlyMap<string, string>,
  ordersByLegacyId: ReadonlyMap<string, OrderPlan>,
  context: { timeZone: string; issues: Issues },
): LedgerPlan<CustomerEntryType>[] {
  const linked = new Set<string>();
  const classify = (
    row: EntryRow,
    partyId: string,
    ref: string,
  ): Classified<CustomerEntryType> | null => {
    const kind = text(row.type)?.toLowerCase();
    const order = ordersByLegacyId.get(text(row.orderId ?? null) ?? '');
    const ours = order?.customerId === partyId ? order : undefined;
    if (kind === 'debit') {
      const sale = ours?.paymentMethod === 'UDHAAR' && !linked.has(`sale:${ours.id}`);
      if (sale) {
        linked.add(`sale:${ours.id}`);
        return { type: 'CREDIT_SALE', sign: 1, orderId: ours.id };
      }
      return { type: 'MANUAL_CREDIT', sign: 1 };
    }
    if (kind === 'credit' || kind === 'payment') {
      const refund = ours?.refund?.settlement === 'KHATA_CREDIT' ? ours.refund : null;
      if (refund !== null && !linked.has(`refund:${refund.id}`)) {
        linked.add(`refund:${refund.id}`);
        return { type: 'REFUND_CREDIT', sign: -1, refundId: refund.id };
      }
      return { type: 'PAYMENT', sign: -1, paymentMethod: paidWith(row, context.issues, ref) };
    }
    context.issues.block('unknown-ledger-type', ref, `type "${row.type ?? ''}"`);
    return null;
  };
  return planEntries('customer_transactions', rows, customerIdOf, classify, context);
}

/** Vendor khata: a purchase raises what the shop owes (D-20); a payment lowers it. */
export function planVendorEntries(
  rows: readonly EntryRow[],
  vendorIdOf: ReadonlyMap<string, string>,
  context: { timeZone: string; issues: Issues },
): LedgerPlan<VendorEntryType>[] {
  const classify = (
    row: EntryRow,
    _partyId: string,
    ref: string,
  ): Classified<VendorEntryType> | null => {
    const kind = text(row.type)?.toLowerCase();
    if (kind === 'purchase') {
      return { type: 'PURCHASE', sign: 1 };
    }
    if (kind === 'payment') {
      return { type: 'PAYMENT', sign: -1, paymentMethod: paidWith(row, context.issues, ref) };
    }
    context.issues.block('unknown-ledger-type', ref, `type "${row.type ?? ''}"`);
    return null;
  };
  return planEntries('vendor_transactions', rows, vendorIdOf, classify, context);
}
