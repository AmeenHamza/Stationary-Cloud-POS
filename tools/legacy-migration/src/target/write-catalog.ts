import { insertRows } from './insert.js';
import { checkpoint, columns, type StepResult, type WriteContext } from './step.js';

import type { CategoryPlan } from '../transform/catalog.js';
import type { ProductPlan } from '../transform/products.js';

const MOVEMENT_NOTE = 'Stock from the old system';

const PRODUCT_COLUMNS = columns(`id legacy_id barcode legacy_barcode name name_key name_urdu
  category_id base_unit_label pieces_per_box sale_price box_price cost_price tax_rate
  low_stock_threshold_pieces low_stock_threshold_unit stock_pieces archived_at created_at updated_at`);

/** Categories, products, and one MIGRATION movement per newly written product with stock ≠ 0. */
export async function writeCatalog(
  context: WriteContext,
  categories: readonly CategoryPlan[],
  products: readonly ProductPlan[],
): Promise<StepResult[]> {
  const { client, batchSize, runAt } = context;
  const at = (date: Date | null): Date => date ?? runAt;
  const newCategories = await insertRows(
    client,
    {
      table: 'categories',
      columns: columns('id legacy_id name description created_at updated_at'),
      conflict: '(id)',
    },
    categories.map((c) => [
      c.id,
      c.legacyId,
      c.name,
      c.description,
      at(c.createdAt),
      at(c.createdAt),
    ]),
    batchSize,
  );
  const newProducts = await insertRows<{ id: string }>(
    client,
    { table: 'products', columns: PRODUCT_COLUMNS, conflict: '(id)', returning: 'id' },
    products.map((p) => [
      ...[p.id, p.legacyId, p.barcode, p.legacyBarcode, p.name, p.nameKey, p.nameUrdu],
      ...[p.categoryId, p.baseUnitLabel, p.piecesPerBox, p.salePrice, p.boxPrice, p.costPrice],
      ...[p.taxRate, p.lowStockThresholdPieces, p.lowStockThresholdUnit, p.stockPieces],
      ...[p.archived ? at(p.updatedAt) : null, at(p.createdAt), at(p.updatedAt ?? p.createdAt)],
    ]),
    batchSize,
  );
  const inserted = new Set(newProducts.rows.map((row) => row.id));
  const stocked = products.filter((p) => inserted.has(p.id) && p.stockPieces !== 0);
  const movements = await insertRows(
    client,
    {
      table: 'stock_movements',
      columns: columns('product_id type quantity_pieces balance_after note created_at'),
      conflict: '',
    },
    stocked.map((p) => [p.id, 'MIGRATION', p.stockPieces, p.stockPieces, MOVEMENT_NOTE, runAt]),
    batchSize,
  );
  return [
    checkpoint(context, 'categories', newCategories),
    checkpoint(context, 'products', newProducts),
    checkpoint(context, 'stock_movements', movements),
  ];
}
