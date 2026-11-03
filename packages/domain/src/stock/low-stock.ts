/**
 * Low stock when stock ≤ threshold (BR-02; out of stock at 0 or below). This rule exists only here
 * and in the `products_low_stock_idx` predicate (DATABASE.md §4.5).
 */
export function isLowStock(stockPieces: number, thresholdPieces: number): boolean {
  return stockPieces <= thresholdPieces;
}

export function isOutOfStock(stockPieces: number): boolean {
  return stockPieces <= 0;
}

/** True when a stock change moves a product into or out of the low-stock state. */
export function crossesLowStockThreshold(
  before: number,
  after: number,
  thresholdPieces: number,
): boolean {
  return isLowStock(before, thresholdPieces) !== isLowStock(after, thresholdPieces);
}
