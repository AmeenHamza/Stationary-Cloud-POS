import { formatRs, splitPieces } from '@pos/domain';

import type { ProductFieldsFragment } from '@/graphql/__generated__/graphql';
import type { AdjustmentReason } from '@pos/contracts';

/** A product row as lists and dialogs show it (the `ProductFields` fragment). */
export type CatalogProduct = ProductFieldsFragment;

/** "27 pcs", plus "2 boxes + 3" when the product comes in boxes (stock may be negative, D-16). */
export function stockLabel(product: Pick<CatalogProduct, 'stockPieces' | 'piecesPerBox'>): {
  pieces: string;
  boxes: string | null;
} {
  const split = splitPieces(product.stockPieces, product.piecesPerBox);
  return {
    pieces: `${String(product.stockPieces)} pcs`,
    boxes:
      split.boxes === 0
        ? null
        : `${String(split.boxes)} box${split.boxes === 1 ? '' : 'es'} + ${String(split.pieces)}`,
  };
}

/** "Rs 10.00", plus "Rs 100.00 / box" when a box price is set (D-17). */
export function priceLabel(product: Pick<CatalogProduct, 'salePrice' | 'boxPrice'>): {
  piece: string;
  box: string | null;
} {
  return {
    piece: formatRs(product.salePrice),
    box: product.boxPrice === null ? null : `${formatRs(product.boxPrice)} / box`,
  };
}

export const ADJUSTMENT_REASON_LABEL: Readonly<Record<AdjustmentReason, string>> = {
  DAMAGED: 'Damaged',
  LOST: 'Lost or stolen',
  COUNT_CORRECTION: 'Count correction',
  OTHER: 'Other',
};
