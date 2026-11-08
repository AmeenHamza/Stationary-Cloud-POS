import {
  billDiscountOf,
  billGstOf,
  calculateBill,
  DomainRuleError,
  lineDiscountOf,
  money,
  percent,
  piecesPerUnit,
  type BillResult,
  type Decimal,
} from '@pos/domain';

import type { CartLine, CartState, CustomCartLine } from './cart.types';
import type { SaleProductFieldsFragment as SaleProduct } from '@/graphql/__generated__/graphql';

export interface PreviewLine {
  line: CartLine;
  /** Undefined while the product is still loading. */
  product: SaleProduct | undefined;
  /** Null when the product cannot be sold this way (archived, or a box without a box price). */
  unitPrice: Decimal | null;
  lineGross: Decimal | null;
  /** D-16: more than the cached stock across this product's lines; the sale is still allowed. */
  aboveStock: boolean;
}

export interface CustomPreviewLine {
  line: CustomCartLine;
  lineGross: Decimal;
}

export interface CartPreview {
  lines: PreviewLine[];
  customLines: CustomPreviewLine[];
  itemCount: number;
  /** Null for an empty cart, a line that is loading or unsellable, or an invalid entry. */
  bill: BillResult | null;
  /** Why the discount or Bill GST entry cannot be used. */
  entryError: string | null;
  /** Every line is loaded and sellable. */
  priced: boolean;
}

function unitPriceOf(line: CartLine, product: SaleProduct | undefined): Decimal | null {
  if (product?.archivedAt !== null) {
    return null;
  }
  const price = line.unit === 'BOX' ? product.boxPrice : product.salePrice;
  return price === null ? null : money(price);
}

function piecesByProduct(lines: readonly PreviewLine[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const { line, product } of lines) {
    const pieces = line.quantity * piecesPerUnit(line.unit, product?.piecesPerBox ?? 1);
    totals.set(line.productId, (totals.get(line.productId) ?? 0) + pieces);
  }
  return totals;
}

function billOf(
  cart: CartState,
  lines: readonly PreviewLine[],
  customLines: readonly CustomPreviewLine[],
  gstRate: string,
) {
  try {
    const bill = calculateBill(
      [
        ...lines.map(({ line, product, unitPrice }) => ({
          unitPrice: unitPrice ?? money('0'),
          quantity: line.quantity,
          taxRate: percent(product?.taxRate ?? '0'),
          discount: lineDiscountOf(line.discount),
        })),
        ...customLines.map(({ line }) => ({
          unitPrice: money(line.unitPrice),
          quantity: line.quantity,
          taxRate: percent(line.taxRate),
          discount: lineDiscountOf(line.discount),
        })),
      ],
      billDiscountOf(cart.discount),
      billGstOf({ applied: cart.billGst.applied, rate: gstRate }),
    );
    return { bill, entryError: null };
  } catch (error) {
    if (error instanceof DomainRuleError) {
      return { bill: null, entryError: error.message };
    }
    throw error;
  }
}

/**
 * The cart priced from cached products with the API's own `calculateBill` (ADR-013), so the total
 * the cashier sees is the `expectedTotal` the server checks against locked prices.
 * `gstRate` is the entered rate, or the shop default (Q26).
 */
export function previewCart(
  cart: CartState,
  products: ReadonlyMap<string, SaleProduct>,
  gstRate: string,
): CartPreview {
  const draft = cart.lines.map((line) => {
    const product = products.get(line.productId);
    const unitPrice = unitPriceOf(line, product);
    return {
      line,
      product,
      unitPrice,
      lineGross: unitPrice?.times(line.quantity) ?? null,
      aboveStock: false,
    };
  });
  const pieces = piecesByProduct(draft);
  const lines = draft.map((entry) => ({
    ...entry,
    aboveStock:
      entry.product !== undefined &&
      (pieces.get(entry.line.productId) ?? 0) > entry.product.stockPieces,
  }));
  const customLines = cart.customLines.map((line) => ({
    line,
    lineGross: money(line.unitPrice).times(line.quantity),
  }));
  const priced =
    lines.length + customLines.length > 0 && lines.every((entry) => entry.unitPrice !== null);
  const itemCount =
    lines.reduce((count, entry) => count + entry.line.quantity, 0) +
    customLines.reduce((count, entry) => count + entry.line.quantity, 0);
  if (!priced) {
    return { lines, customLines, itemCount, bill: null, entryError: null, priced };
  }
  return { lines, customLines, itemCount, priced, ...billOf(cart, lines, customLines, gstRate) };
}
