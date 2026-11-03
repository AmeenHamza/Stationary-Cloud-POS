import type { Decimal } from '../money/decimal.js';

/** One cart line as priced at sale time: piece price for PIECE, box price for BOX (D-17). */
export interface BillLineInput {
  unitPrice: Decimal;
  quantity: number;
  /** Product tax percentage, added on top of the price (D-07). */
  taxRate: Decimal;
}

export type BillDiscount =
  { type: 'NONE' } | { type: 'FLAT'; amount: Decimal } | { type: 'PERCENT'; percent: Decimal };

export type BillGst = { applied: false } | { applied: true; rate: Decimal };

export interface BillLineResult {
  lineGross: Decimal;
  lineDiscount: Decimal;
  lineNet: Decimal;
  lineTax: Decimal;
}

export interface BillResult {
  lines: BillLineResult[];
  subtotal: Decimal;
  discountTotal: Decimal;
  productTaxTotal: Decimal;
  billGstRate: Decimal | null;
  billGstAmount: Decimal;
  total: Decimal;
}
