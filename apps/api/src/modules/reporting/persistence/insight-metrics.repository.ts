import { Injectable } from '@nestjs/common';

import { Prisma } from '@pos/database';

import { TransactionalClient } from '../../../infrastructure/prisma/transactional-client';

import { netProductSales } from './net-product-sales';

/** Stock velocity of one product over the window; money and rates as exact text. */
export interface VelocityRow {
  name: string;
  stockPieces: number;
  piecesPerBox: number;
  lowStockThresholdPieces: number;
  unitsSold: number;
  unitsPerDay: string;
  daysOfCover: string | null;
  piecesFor30Days: number;
  costPrice: string | null;
  estimatedCost: string | null;
}

export interface SlowStockRow {
  name: string;
  stockPieces: number;
  unitsSold: number;
  salePrice: string;
  costPrice: string | null;
  stockCostValue: string;
}

export interface ProductSalesRow {
  name: string;
  unitsSold: number;
  total: string;
  stockPieces: number;
}

/**
 * Product-level aggregates for the AI Assistant (SYSTEM_DESIGN.md §8): bounded by `limit` (≤ 50),
 * active products only, product names and numbers only (Q17b). Read-only, like all of reporting.
 */
@Injectable()
export class InsightMetricsRepository {
  constructor(private readonly db: TransactionalClient) {}

  /**
   * Sold or low-stock products, soonest to run out first. `piecesFor30Days` is what 30 more days
   * would need at the window's rate, less the stock on hand (Q38).
   */
  velocity(from: string, to: string, days: number, limit: number) {
    const sold = Prisma.sql`coalesce(n.pieces, 0)`;
    const need = Prisma.sql`greatest(ceil(${sold}::numeric * 30 / ${days}) - greatest(p.stock_pieces, 0), 0)`;
    return this.db.client.$queryRaw<VelocityRow[]>`
      WITH ${netProductSales(from, to)}
      SELECT p.name, p.stock_pieces AS "stockPieces", p.pieces_per_box AS "piecesPerBox",
             p.low_stock_threshold_pieces AS "lowStockThresholdPieces", ${sold}::int AS "unitsSold",
             round(${sold}::numeric / ${days}, 2)::text AS "unitsPerDay",
             CASE WHEN ${sold} > 0
                  THEN round(greatest(p.stock_pieces, 0)::numeric * ${days} / ${sold}, 1)::text END
               AS "daysOfCover",
             ${need}::int AS "piecesFor30Days", p.cost_price::text AS "costPrice",
             (${need} * p.cost_price)::text AS "estimatedCost"
      FROM products p LEFT JOIN net n ON n.product_id = p.id
      WHERE p.archived_at IS NULL AND (n.pieces > 0 OR p.stock_pieces <= p.low_stock_threshold_pieces)
      ORDER BY (${sold} > 0) DESC, greatest(p.stock_pieces, 0)::numeric / nullif(${sold}, 0),
               p.stock_pieces, p.name, p.id
      LIMIT ${limit}`;
  }

  /** Products in stock that sold least in the window, most capital tied up first (discount advice). */
  slowStock(from: string, to: string, limit: number) {
    return this.db.client.$queryRaw<SlowStockRow[]>`
      WITH ${netProductSales(from, to)}
      SELECT p.name, p.stock_pieces AS "stockPieces", coalesce(n.pieces, 0)::int AS "unitsSold",
             p.sale_price::text AS "salePrice", p.cost_price::text AS "costPrice",
             (p.stock_pieces * coalesce(p.cost_price, 0))::text AS "stockCostValue"
      FROM products p LEFT JOIN net n ON n.product_id = p.id
      WHERE p.archived_at IS NULL AND p.stock_pieces > 0
      ORDER BY coalesce(n.pieces, 0), p.stock_pieces * coalesce(p.cost_price, p.sale_price) DESC,
               p.name, p.id
      LIMIT ${limit}`;
  }

  /** Units and net amount sold in the window for the given products, best sellers first. */
  productSales(productIds: readonly string[], from: string, to: string) {
    return this.db.client.$queryRaw<ProductSalesRow[]>`
      WITH ${netProductSales(from, to)}
      SELECT p.name, coalesce(n.pieces, 0)::int AS "unitsSold",
             coalesce(n.amount, 0)::text AS total, p.stock_pieces AS "stockPieces"
      FROM products p LEFT JOIN net n ON n.product_id = p.id
      WHERE p.id = ANY(${[...productIds]}::uuid[])
      ORDER BY coalesce(n.pieces, 0) DESC, p.name, p.id`;
  }

  /** Active products whose name or Urdu name contains `search` (at most `limit`). */
  async matchingProductIds(search: string, limit: number): Promise<string[]> {
    const rows = await this.db.client.product.findMany({
      where: {
        archivedAt: null,
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { nameUrdu: { contains: search, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: limit,
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  /** Low-stock products (stock at or below the threshold), emptiest first. */
  lowStock(limit: number) {
    const fields = this.db.client.product.fields;
    return this.db.client.product.findMany({
      where: { archivedAt: null, stockPieces: { lte: fields.lowStockThresholdPieces } },
      orderBy: [{ stockPieces: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      take: limit,
      select: { name: true, stockPieces: true, lowStockThresholdPieces: true, piecesPerBox: true },
    });
  }
}
