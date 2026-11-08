import { MAX_LINES_PER_SALE, MAX_QUANTITY_PER_LINE } from '@pos/contracts';

import { DomainRuleError } from '../errors.js';
import { allocate } from '../money/allocate.js';
import { sum } from '../money/money.js';

import { discountTotal, itemDiscount } from './discount.js';
import { billGstAmount, lineTax } from './tax.js';

import type { BillDiscount, BillGst, BillLineInput, BillResult } from './bill.types.js';

const NO_DISCOUNT: BillDiscount = { type: 'NONE' };

function assertLines(lines: readonly BillLineInput[]): void {
  if (lines.length === 0 || lines.length > MAX_LINES_PER_SALE) {
    throw new DomainRuleError(
      'BAD_USER_INPUT',
      `A bill needs 1 to ${String(MAX_LINES_PER_SALE)} lines`,
      'lines',
    );
  }
  for (const line of lines) {
    const validQuantity =
      Number.isInteger(line.quantity) &&
      line.quantity >= 1 &&
      line.quantity <= MAX_QUANTITY_PER_LINE;
    if (!validQuantity || line.unitPrice.isNegative()) {
      throw new DomainRuleError(
        'BAD_USER_INPUT',
        'Each line needs a valid quantity and price',
        'lines',
      );
    }
  }
}

/**
 * Authoritative bill calculation (SYSTEM_DESIGN.md §3.2). The API runs it on locked product rows;
 * the terminal runs the same function for the cart preview (ADR-013).
 *
 * subtotal → item discounts (D-27) → bill discount on what is left (allocated to lines) → product
 * tax per line → Bill GST on (discounted subtotal + product tax) → total. No rupee rounding of the
 * total (D-09).
 */
export function calculateBill(
  lines: readonly BillLineInput[],
  discount: BillDiscount,
  gst: BillGst,
): BillResult {
  assertLines(lines);
  const priced = lines.map((line) => {
    const lineGross = line.unitPrice.times(line.quantity);
    const own = itemDiscount(lineGross, line.discount ?? NO_DISCOUNT);
    return { line, lineGross, own, left: lineGross.minus(own) };
  });
  const subtotal = sum(priced.map((p) => p.lineGross));
  const itemDiscountTotal = sum(priced.map((p) => p.own));
  const billDiscountTotal = discountTotal(subtotal.minus(itemDiscountTotal), discount);
  const results = allocate(billDiscountTotal, priced, (p) => p.left).map(({ item, share }) => {
    const lineDiscount = item.own.plus(share);
    const lineNet = item.lineGross.minus(lineDiscount);
    return {
      lineGross: item.lineGross,
      itemDiscount: item.own,
      lineDiscount,
      lineNet,
      lineTax: lineTax(lineNet, item.line.taxRate),
    };
  });
  const productTaxTotal = sum(results.map((r) => r.lineTax));
  const totalDiscount = itemDiscountTotal.plus(billDiscountTotal);
  const netTotal = subtotal.minus(totalDiscount);
  const gstAmount = billGstAmount(netTotal.plus(productTaxTotal), gst);
  return {
    lines: results,
    subtotal,
    discountTotal: totalDiscount,
    itemDiscountTotal,
    billDiscountTotal,
    productTaxTotal,
    billGstRate: gst.applied ? gst.rate : null,
    billGstAmount: gstAmount,
    total: netTotal.plus(productTaxTotal).plus(gstAmount),
  };
}
