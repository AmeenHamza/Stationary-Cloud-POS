import type { Decimal } from '../money/decimal.js';

export type BillDiscount =
  { type: 'NONE' } | { type: 'FLAT'; amount: Decimal } | { type: 'PERCENT'; percent: Decimal };

/** One cart line as priced at sale time: piece price for PIECE, box price for BOX (D-17). */
export interface BillLineInput {
  unitPrice: Decimal;
  quantity: number;
  /** Product tax percentage, added on top of the price (D-07). */
  taxRate: Decimal;
  /** A discount on this item alone (D-27), taken before the bill discount. */
  discount?: BillDiscount;
}

export type BillGst = { applied: false } | { applied: true; rate: Decimal };

export interface BillLineResult {
  lineGross: Decimal;
  /** This item's own discount (D-27). */
  itemDiscount: Decimal;
  /** The item discount plus this line's share of the bill discount. */
  lineDiscount: Decimal;
  lineNet: Decimal;
  lineTax: Decimal;
}

export interface BillResult {
  lines: BillLineResult[];
  subtotal: Decimal;
  /** Every discount on the bill: `itemDiscountTotal + billDiscountTotal`. */
  discountTotal: Decimal;
  itemDiscountTotal: Decimal;
  billDiscountTotal: Decimal;
  productTaxTotal: Decimal;
  billGstRate: Decimal | null;
  billGstAmount: Decimal;
  total: Decimal;
}
