import {
  billDiscountOf,
  billGstOf,
  calculateBill,
  lineDiscountOf,
  money,
  percent,
  piecesPerUnit,
  type BillResult,
} from '@pos/domain';

import { AppError } from '../../../common/errors/app-error';

import type { SaleProductRow } from '../../catalog';
import type { SaleUnit } from '@pos/contracts';
import type { CreateSaleInput } from '@pos/validation';

/** A cart line priced from its locked product row (rule 6: prices never come from the client). */
export interface PricedLine {
  product: SaleProductRow;
  unit: SaleUnit;
  quantity: number;
  unitPrice: string;
  piecesPerUnit: number;
  /** The cashier's discount on this item (D-27). */
  discount: LineDiscount;
}

export type LineDiscount = CreateSaleInput['lines'][number]['discount'];

/**
 * Prices each line: piece price, or box price for BOX (D-17). Missing or archived products are
 * NOT_FOUND (with their ids, so the terminal can drop them); a box without a box price is refused.
 */
export function priceLines(
  lines: CreateSaleInput['lines'],
  locked: readonly SaleProductRow[],
): PricedLine[] {
  const byId = new Map(locked.map((row) => [row.id, row]));
  const unavailable = lines
    .map((line) => line.productId)
    .filter((id) => byId.get(id)?.archivedAt !== null);
  if (unavailable.length > 0) {
    throw new AppError(
      'NOT_FOUND',
      'Some items are no longer for sale. Remove them and try again.',
      {
        productIds: [...new Set(unavailable)],
      },
    );
  }
  return lines.map((line) => {
    const product = byId.get(line.productId);
    if (product === undefined) {
      throw new Error('locked product missing'); // unreachable: checked above
    }
    const unitPrice = line.unit === 'BOX' ? product.boxPrice : product.salePrice;
    if (unitPrice === null) {
      throw new AppError('BAD_USER_INPUT', `${product.name} is not sold by the box.`, {
        fieldErrors: { lines: `${product.name} has no box price` },
      });
    }
    return {
      product,
      unit: line.unit,
      quantity: line.quantity,
      unitPrice,
      piecesPerUnit: piecesPerUnit(line.unit, product.piecesPerBox),
      discount: line.discount,
    };
  });
}

export interface BillLineInput {
  unitPrice: string;
  quantity: number;
  taxRate: string;
  discount: LineDiscount;
}

/** The authoritative bill (SYSTEM_DESIGN.md §3.2): the same domain function as the cart preview. */
export function billOf(
  priced: readonly BillLineInput[],
  discount: CreateSaleInput['discount'],
  billGst: CreateSaleInput['billGst'],
): BillResult {
  return calculateBill(
    priced.map((line) => ({
      unitPrice: money(line.unitPrice),
      quantity: line.quantity,
      taxRate: percent(line.taxRate),
      discount: lineDiscountOf(line.discount),
    })),
    billDiscountOf(discount),
    billGstOf(billGst),
  );
}
