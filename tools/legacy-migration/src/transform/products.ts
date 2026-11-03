import { Decimal, normalizeNameKey } from '@pos/domain';

import { capped, flag, integer, legacyUuid, money, text } from './values.js';

import type { Issues } from './issues.js';
import type { LegacyRow } from '../legacy/schema-map.js';
import type { SaleUnit } from '@pos/contracts';

export interface ProductPlan {
  id: string;
  legacyId: string;
  barcode: string | null;
  legacyBarcode: string | null;
  name: string;
  nameKey: string;
  nameUrdu: string | null;
  categoryId: string | null;
  baseUnitLabel: string;
  piecesPerBox: number;
  salePrice: string;
  boxPrice: string | null;
  costPrice: string | null;
  taxRate: string;
  lowStockThresholdPieces: number;
  lowStockThresholdUnit: SaleUnit;
  stockPieces: number;
  archived: boolean;
}

type Row = LegacyRow<'products'>;

const IMPLAUSIBLE_STOCK = 100_000;
const IMPLAUSIBLE_PRICE = new Decimal(1_000_000);
const IMPLAUSIBLE_VALUE = new Decimal(10_000_000);

/** An active barcode already taken moves to `legacy_barcode` (Q35); one over 64 characters too. */
function barcodes(
  row: Row,
  archived: boolean,
  taken: Map<string, string>,
  issues: Issues,
  ref: string,
): { barcode: string | null; legacyBarcode: string | null } {
  const barcode = text(row.barcode);
  if (barcode !== null && barcode.length > 64) {
    issues.note('barcode-too-long', ref, 'barcode over 64 characters kept as legacy_barcode');
    return { barcode: null, legacyBarcode: barcode.slice(0, 128) };
  }
  if (barcode === null || archived) {
    return { barcode, legacyBarcode: null };
  }
  const holder = taken.get(barcode);
  if (holder !== undefined) {
    issues.note('barcode-duplicate', ref, `barcode also on products#${holder}; kept there (Q35)`);
    return { barcode: null, legacyBarcode: barcode };
  }
  taken.set(barcode, row.id ?? '');
  return { barcode, legacyBarcode: null };
}

/** Prices and tax rate rounded to the paisa; a box price needs more than one piece per box. */
function prices(row: Row, piecesPerBox: number, issues: Issues, ref: string) {
  const salePrice = money(row.price, issues, ref, 'price');
  let boxPrice = text(row.boxPrice) === null ? null : money(row.boxPrice, issues, ref, 'box price');
  if (boxPrice !== null && piecesPerBox <= 1) {
    issues.note('box-price-dropped', ref, 'box price without more than one piece per box dropped');
    boxPrice = null;
  }
  const costPrice = text(row.cost) === null ? null : money(row.cost, issues, ref, 'cost');
  const taxRate = money(row.taxRate, issues, ref, 'tax rate');
  for (const [field, value] of [
    ['price', salePrice],
    ['cost', costPrice],
    ['box price', boxPrice],
  ] as const) {
    if (value?.isNegative() === true) {
      issues.block('invalid-value', ref, `${field} is negative`);
    }
  }
  if (taxRate.isNegative() || taxRate.greaterThan(100)) {
    issues.block('invalid-value', ref, `tax rate ${taxRate.toString()} is outside 0–100`);
  }
  return { salePrice, boxPrice, costPrice, taxRate };
}

/** Stock in pieces (whole numbers only); implausible stock or prices are listed for the owner (Q19). */
function stockOf(row: Row, salePrice: Decimal, issues: Issues, ref: string): number {
  const stock = integer(row.stock);
  if (stock === null && text(row.stock) !== null) {
    issues.block('invalid-value', ref, `stock "${row.stock ?? ''}" is not a whole number`);
  }
  const pieces = stock ?? 0;
  const value = salePrice.times(Math.max(pieces, 0));
  if (
    pieces < 0 ||
    pieces > IMPLAUSIBLE_STOCK ||
    salePrice.greaterThan(IMPLAUSIBLE_PRICE) ||
    value.greaterThan(IMPLAUSIBLE_VALUE)
  ) {
    issues.note(
      'implausible-product',
      ref,
      `stock ${String(pieces)} at Rs ${salePrice.toFixed(2)} (Q19)`,
    );
  }
  return pieces;
}

function threshold(row: Row, piecesPerBox: number, issues: Issues, ref: string) {
  const byBox = text(row.lowStockUnit)?.toLowerCase() === 'box';
  const value = integer(row.lowStockThreshold) ?? 10;
  if (value < 0) {
    issues.block('invalid-value', ref, 'low-stock threshold is negative');
  }
  const unit: SaleUnit = byBox ? 'BOX' : 'PIECE';
  return { pieces: byBox ? value * piecesPerBox : value, unit };
}

/** Products in id order (DATABASE.md §11 step 1); inactive ones are archived. */
export function planProducts(
  rows: readonly Row[],
  categoryIdOf: ReadonlyMap<string, string>,
  issues: Issues,
): ProductPlan[] {
  const taken = new Map<string, string>();
  return rows.map((row) => {
    const legacyId = row.id ?? '';
    const ref = `products#${legacyId}`;
    const name = capped(row.name, 200, issues, ref, 'name') ?? '';
    if (name === '') {
      issues.block('invalid-value', ref, 'the product has no name');
    }
    const archived = flag(row.isActive) === false;
    const piecesPerBox = integer(row.piecesPerBox) ?? 1;
    if (piecesPerBox < 1 || piecesPerBox > 10_000) {
      issues.block('invalid-value', ref, `pieces per box ${String(piecesPerBox)} outside 1–10,000`);
    }
    const price = prices(row, piecesPerBox, issues, ref);
    const legacyCategory = text(row.categoryId);
    const categoryId = legacyCategory === null ? null : (categoryIdOf.get(legacyCategory) ?? null);
    if (legacyCategory !== null && categoryId === null) {
      issues.note('missing-reference', ref, `categories#${legacyCategory} missing; uncategorised`);
    }
    const low = threshold(row, piecesPerBox, issues, ref);
    return {
      id: legacyUuid('product', legacyId),
      legacyId,
      ...barcodes(row, archived, taken, issues, ref),
      name,
      nameKey: normalizeNameKey(name),
      nameUrdu: capped(row.nameUrdu, 200, issues, ref, 'Urdu name'),
      categoryId,
      baseUnitLabel: capped(row.baseUnit, 20, issues, ref, 'base unit') ?? 'Piece',
      piecesPerBox,
      salePrice: price.salePrice.toFixed(2),
      boxPrice: price.boxPrice?.toFixed(2) ?? null,
      costPrice: price.costPrice?.toFixed(2) ?? null,
      taxRate: price.taxRate.toFixed(2),
      lowStockThresholdPieces: low.pieces,
      lowStockThresholdUnit: low.unit,
      stockPieces: stockOf(row, price.salePrice, issues, ref),
      archived,
    };
  });
}
