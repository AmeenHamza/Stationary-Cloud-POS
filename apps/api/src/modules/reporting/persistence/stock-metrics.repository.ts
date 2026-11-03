import { Injectable } from '@nestjs/common';

import { Prisma } from '@pos/database';

import { TransactionalClient } from '../../../infrastructure/prisma/transactional-client';

import { netProductSales } from './net-product-sales';

import type { RankingDirection } from '@pos/contracts';

export interface InventoryRow {
  sellingValue: string;
  costValue: string;
  productCount: number;
}

export interface RankingRow {
  productId: string;
  name: string;
  units: number;
  total: string;
}

export interface KhataTotalsRow {
  customerDues: string;
  customerCount: number;
  vendorOwes: string;
  vendorCount: number;
}

export interface CategoryTotalsRow {
  categoryCount: number;
}

const ORDER: Readonly<Record<RankingDirection, Prisma.Sql>> = {
  HIGHEST: Prisma.sql`DESC`,
  LOWEST: Prisma.sql`ASC`,
};

/** Inventory value, customer dues and product rankings for the dashboard (API.md §6.3). */
@Injectable()
export class StockMetricsRepository {
  constructor(private readonly db: TransactionalClient) {}

  /** Active products; values count positive stock only (negative stock is not an asset, D-16). */
  async inventory(): Promise<InventoryRow> {
    const [row] = await this.db.client.$queryRaw<InventoryRow[]>`
      SELECT coalesce(sum(stock_pieces * sale_price) FILTER (WHERE stock_pieces > 0), 0)::text
               AS "sellingValue",
             coalesce(sum(stock_pieces * coalesce(cost_price, 0)) FILTER (WHERE stock_pieces > 0), 0)::text
               AS "costValue",
             count(*)::int AS "productCount"
      FROM products WHERE archived_at IS NULL`;
    if (row === undefined) throw new Error('aggregate returned no row');
    return row;
  }

  /** Number of categories in the catalogue. */
  async categoryTotals(): Promise<CategoryTotalsRow> {
    const [row] = await this.db.client.$queryRaw<CategoryTotalsRow[]>`
      SELECT count(*)::int AS "categoryCount" FROM categories`;
    if (row === undefined) throw new Error('aggregate returned no row');
    return row;
  }

  /** Active parties and positive balances (dues/owes), read once for customer+vendor KPIs. */
  async khataTotals(): Promise<KhataTotalsRow> {
    const [row] = await this.db.client.$queryRaw<KhataTotalsRow[]>`
      SELECT
        (SELECT coalesce(sum(balance) FILTER (WHERE balance > 0), 0)::text FROM customers)
          AS "customerDues",
        (SELECT count(*)::int FROM customers WHERE archived_at IS NULL)
          AS "customerCount",
        (SELECT coalesce(sum(balance) FILTER (WHERE balance > 0), 0)::text FROM vendors)
          AS "vendorOwes",
        (SELECT count(*)::int FROM vendors WHERE archived_at IS NULL)
          AS "vendorCount"`;
    if (row === undefined) throw new Error('aggregate returned no row');
    return row;
  }

  /**
   * Products by units sold (pieces) in [from, to]: sales by bill date minus returns by refund date,
   * only products with net sales in the window (Q18, Q36), ties by name.
   */
  ranking(direction: RankingDirection, limit: number, from: string, to: string) {
    return this.db.client.$queryRaw<RankingRow[]>`
      WITH ${netProductSales(from, to)}
      SELECT n.product_id::text AS "productId", p.name, n.pieces::int AS units, n.amount::text AS total
      FROM net n JOIN products p ON p.id = n.product_id
      WHERE n.pieces > 0
      ORDER BY n.pieces ${ORDER[direction]}, p.name, p.id
      LIMIT ${limit}`;
  }
}
