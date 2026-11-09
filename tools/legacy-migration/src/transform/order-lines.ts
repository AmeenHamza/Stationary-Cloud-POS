import { Decimal, ZERO, allocate, round2, sum } from '@pos/domain';

import { capped, integer, money, text } from './values.js';

import type { Issues } from './issues.js';
import type { ProductPlan } from './products.js';
import type { LegacyRow } from '../legacy/schema-map.js';
import type { SaleUnit } from '@pos/contracts';

export interface LinePlan {
  lineNo: number;
  productId: string | null;
  productName: string;
  productNameUrdu: string | null;
  barcode: string | null;
  saleUnit: SaleUnit;
  piecesPerUnit: number;
  quantity: number;
  unitPrice: Decimal;
  taxRate: Decimal;
  lineGross: Decimal;
  /** The item's own discount (D-27); the old app's `order_items.discount`. */
  itemDiscount: Decimal;
  lineDiscount: Decimal;
  lineNet: Decimal;
  lineTax: Decimal;
  refundedQuantity: number;
}

const MAX_LINES = 100;
const MAX_QUANTITY = 10_000;

/**
 * The rate the old app charged on an item: its tax over its price, as the old app taxed the price
 * before any discount (MAPPING.md §2.4). Today's product rate may differ, so it is not used.
 */
function chargedRate(lineTax: Decimal, lineGross: Decimal): Decimal {
  if (lineTax.isZero() || lineGross.isZero()) {
    return ZERO;
  }
  return Decimal.min(round2(lineTax.times(100).dividedBy(lineGross)), 100);
}

/** One old item as a line, before the bill discount is spread (null when it cannot be read). */
function lineOf(
  item: LegacyRow<'orderItems'>,
  lineNo: number,
  products: ReadonlyMap<string, ProductPlan>,
  issues: Issues,
): (LinePlan & { ownDiscount: Decimal }) | null {
  const ref = `order_items#${item.id ?? ''}`;
  const quantity = integer(item.quantity);
  if (quantity === null || quantity < 1 || quantity > MAX_QUANTITY) {
    issues.block('invalid-value', ref, `quantity "${item.quantity ?? ''}" is not 1–10,000`);
    return null;
  }
  const box = text(item.saleUnit)?.toLowerCase() === 'box';
  const product = products.get(text(item.productId) ?? '');
  const unitPrice = money(item.unitPrice, issues, ref, 'unit price');
  const lineGross = unitPrice.times(quantity);
  const ownDiscount = money(item.discount, issues, ref, 'discount');
  const refundedQuantity = integer(item.refundedQuantity) ?? 0;
  const lineTax = money(item.taxAmount, issues, ref, 'tax');
  if (unitPrice.isNegative() || ownDiscount.isNegative() || ownDiscount.greaterThan(lineGross)) {
    issues.block('invalid-value', ref, 'negative price, or a discount above the line amount');
  }
  if (refundedQuantity < 0 || refundedQuantity > quantity) {
    issues.block(
      'refund-mismatch',
      ref,
      `refunded quantity ${String(refundedQuantity)} of ${String(quantity)}`,
    );
  }
  return {
    lineNo,
    productId: product?.id ?? null,
    productName:
      capped(item.productName, 200, issues, ref, 'product name') ?? product?.name ?? 'Item',
    // Not recorded on the old sale; today's product values would be a guess (MAPPING.md §5.7).
    productNameUrdu: null,
    barcode: null,
    saleUnit: box ? 'BOX' : 'PIECE',
    piecesPerUnit: box ? Math.max(integer(item.piecesPerUnit) ?? 1, 1) : 1,
    quantity,
    unitPrice,
    taxRate: chargedRate(lineTax, lineGross),
    lineGross,
    itemDiscount: ownDiscount,
    lineDiscount: ownDiscount,
    lineNet: lineGross.minus(ownDiscount),
    lineTax,
    refundedQuantity,
    ownDiscount,
  };
}

/**
 * The bill's lines in item order. The old app kept the bill discount on the bill only; it is spread
 * over the lines in proportion to their amounts with `allocate`, as new bills are (Σ line discounts =
 * the bill's discount total, DATABASE.md §12).
 */
export function planLines(
  items: readonly LegacyRow<'orderItems'>[],
  billDiscount: Decimal,
  products: ReadonlyMap<string, ProductPlan>,
  issues: Issues,
  ref: string,
): LinePlan[] | null {
  if (items.length === 0) {
    issues.block('order-without-items', ref, 'the bill has no items');
    return null;
  }
  if (items.length > MAX_LINES) {
    issues.block('too-many-lines', ref, `${String(items.length)} items; the limit is 100 (Q34)`);
    return null;
  }
  const lines = items.map((item, index) => lineOf(item, index + 1, products, issues));
  if (lines.some((line) => line === null)) {
    return null;
  }
  const read = lines.filter((line) => line !== null);
  const room = sum(read.map((line) => line.lineNet));
  if (billDiscount.greaterThan(room)) {
    issues.block(
      'invalid-value',
      ref,
      `bill discount ${billDiscount.toFixed(2)} exceeds the items`,
    );
    return null;
  }
  const shares = room.isZero()
    ? read.map(() => ZERO)
    : allocate(billDiscount, read, (l) => l.lineNet).map((a) => a.share);
  return read.map(({ ownDiscount, ...line }, index) => {
    const lineDiscount = ownDiscount.plus(shares[index] ?? ZERO);
    return { ...line, lineDiscount, lineNet: line.lineGross.minus(lineDiscount) };
  });
}
