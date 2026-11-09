import { Decimal, businessDateOf, parseBillNumber, sum } from '@pos/domain';

import { planLines, type LinePlan } from './order-lines.js';
import { planRefund, type RefundPlan } from './order-refund.js';
import { billGstOf, checkPayments, discountTermsOf, oldTotalOf, statusOf } from './order-terms.js';
import { paymentMethodOf } from './payment-method.js';
import { capped, instant, legacyUuid, money, text } from './values.js';

import type { Issues } from './issues.js';
import type { ProductPlan } from './products.js';
import type { LegacyRow } from '../legacy/schema-map.js';
import type { DiscountType, OrderStatus, PaymentMethod } from '@pos/contracts';

export interface OrderPlan {
  id: string;
  legacyId: string;
  idempotencyKey: string;
  billNumber: string;
  businessDate: string;
  createdAt: Date;
  cashierName: string;
  customerId: string | null;
  paymentMethod: PaymentMethod;
  discountType: DiscountType;
  discountValue: Decimal;
  subtotal: Decimal;
  discountTotal: Decimal;
  itemDiscountTotal: Decimal;
  productTaxTotal: Decimal;
  billGstRate: Decimal | null;
  billGstAmount: Decimal;
  total: Decimal;
  refundedTotal: Decimal;
  status: OrderStatus;
  lines: LinePlan[];
  refund: RefundPlan | null;
}

export interface OrderContext {
  products: ReadonlyMap<string, ProductPlan>;
  customerIdOf: ReadonlyMap<string, string>;
  cashierNames: ReadonlyMap<string, string>;
  itemsOf: (legacyOrderId: string) => readonly LegacyRow<'orderItems'>[];
  paymentsOf: (legacyOrderId: string) => readonly LegacyRow<'orderPayments'>[];
  shopGstRate: Decimal | null;
  timeZone: string;
  issues: Issues;
}

/** The bill number is kept; its date (ORD-YYYYMMDD-n) is the business date when it parses. */
function dated(row: LegacyRow<'orders'>, context: OrderContext, ref: string) {
  const billNumber = text(row.orderNumber) ?? '';
  const createdAt = instant(row.createdAt);
  if (billNumber === '' || billNumber.length > 24 || createdAt === null) {
    context.issues.block('invalid-value', ref, 'missing or over-long bill number, or no date');
    return null;
  }
  const clock = businessDateOf(createdAt, context.timeZone);
  const businessDate = parseBillNumber(billNumber)?.businessDate ?? clock;
  if (businessDate !== clock) {
    context.issues.note('bill-date-differs', ref, `bill dated ${businessDate}, created ${clock}`);
  }
  return { billNumber, createdAt, businessDate };
}

/** One old bill (DATABASE.md §11 step 1); null when it cannot be migrated as it stands. */
function planOrder(row: LegacyRow<'orders'>, context: OrderContext): OrderPlan | null {
  const legacyId = row.id ?? '';
  const ref = `orders#${legacyId}`;
  const { issues } = context;
  const when = dated(row, context, ref);
  const method = paymentMethodOf(row.paymentMethod);
  if (method == null) {
    issues.block('unknown-payment-method', ref, `payment method "${row.paymentMethod ?? ''}"`);
    return null;
  }
  const customerId = context.customerIdOf.get(text(row.customerId) ?? '') ?? null;
  if (method === 'UDHAAR' && customerId === null) {
    issues.block('udhaar-without-customer', ref, 'an Udhaar bill needs its customer (D-15)');
  }
  const billDiscount = money(row.discountAmount, issues, ref, 'discount');
  const lines = planLines(context.itemsOf(legacyId), billDiscount, context.products, issues, ref);
  if (when === null || lines === null) {
    return null;
  }
  const subtotal = sum(lines.map((line) => line.lineGross));
  const discountTotal = sum(lines.map((line) => line.lineDiscount));
  const itemDiscountTotal = sum(lines.map((line) => line.itemDiscount));
  const productTaxTotal = sum(lines.map((line) => line.lineTax));
  const gst = billGstOf(row, context.shopGstRate, issues, ref);
  const total = subtotal.minus(discountTotal).plus(productTaxTotal).plus(gst.amount);
  const payments = context.paymentsOf(legacyId);
  checkPayments(method, payments, total, issues, ref);
  const oldTotal = oldTotalOf(row, payments, issues, ref);
  // Exact: a migrated bill must total what the old app charged (MAPPING.md §2.4).
  if (oldTotal !== null && !oldTotal.equals(total)) {
    issues.block(
      'total-mismatch',
      ref,
      `old total ${oldTotal.toFixed(2)}, items give ${total.toFixed(2)}`,
    );
  }
  const refundedTotal = money(row.refundedAmount, issues, ref, 'refunded amount');
  const terms = discountTermsOf(row, billDiscount, issues, ref);
  return {
    id: legacyUuid('order', legacyId),
    legacyId,
    idempotencyKey: legacyUuid('order-key', legacyId),
    ...when,
    cashierName: context.cashierNames.get(text(row.cashierId) ?? '') ?? 'Old system',
    customerId,
    paymentMethod: method,
    discountType: terms.type,
    discountValue: terms.value,
    subtotal,
    discountTotal,
    itemDiscountTotal,
    productTaxTotal,
    billGstRate: gst.rate,
    billGstAmount: gst.amount,
    total,
    refundedTotal,
    status: statusOf(row.status, refundedTotal, total, issues, ref),
    lines,
    refund: planRefund(
      legacyId,
      refundedTotal,
      lines,
      {
        total,
        billGst: gst.amount,
        method,
        createdAt: when.createdAt,
        businessDate: when.businessDate,
      },
      issues,
      ref,
    ),
  };
}

/** Every bill in id order; bill numbers must be unique in the new system too. */
export function planOrders(
  rows: readonly LegacyRow<'orders'>[],
  context: OrderContext,
): OrderPlan[] {
  const seen = new Map<string, string>();
  const plans: OrderPlan[] = [];
  for (const row of rows) {
    const plan = planOrder(row, context);
    if (plan === null) {
      continue;
    }
    const first = seen.get(plan.billNumber);
    if (first !== undefined) {
      context.issues.block(
        'duplicate-bill-number',
        `orders#${plan.legacyId}`,
        `same number as orders#${first}`,
      );
      continue;
    }
    seen.set(plan.billNumber, plan.legacyId);
    plans.push(plan);
  }
  return plans;
}

/** Cashier names from the old users (users are not migrated, DATABASE.md §11 step 6). */
export function cashierNames(
  rows: readonly LegacyRow<'users'>[],
  issues: Issues,
): Map<string, string> {
  return new Map(
    rows.map((row) => [
      row.id ?? '',
      capped(row.fullName, 120, issues, `users#${row.id ?? ''}`, 'name') ?? 'Old system',
    ]),
  );
}

/** The shop's bill GST rate from the old settings (`bill_gst_percentage`), if valid. */
export function shopGstRate(rows: readonly LegacyRow<'systemSettings'>[]): Decimal | null {
  const value = rows.find((row) => text(row.key) === 'bill_gst_percentage')?.value ?? null;
  try {
    const rate = new Decimal(text(value) ?? 'x');
    return rate.isNegative() || rate.greaterThan(100) ? null : rate.toDecimalPlaces(2);
  } catch {
    return null;
  }
}
