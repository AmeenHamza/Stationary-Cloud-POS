import { Injectable } from '@nestjs/common';

import { TransactionalClient } from '../../../../infrastructure/prisma/transactional-client';

import type { Prisma } from '@pos/database';

/** Columns every product read returns (Product fragment plus the category name, one join). */
export const PRODUCT_SELECT = {
  id: true,
  barcode: true,
  name: true,
  nameUrdu: true,
  categoryId: true,
  baseUnitLabel: true,
  piecesPerBox: true,
  salePrice: true,
  boxPrice: true,
  costPrice: true,
  taxRate: true,
  lowStockThresholdPieces: true,
  lowStockThresholdUnit: true,
  stockPieces: true,
  archivedAt: true,
  version: true,
  category: { select: { name: true } },
} as const satisfies Prisma.ProductSelect;

export type ProductRow = Prisma.ProductGetPayload<{ select: typeof PRODUCT_SELECT }>;

/** Single-row product access (DATABASE.md §4.5). Lists live in `product-list.repository.ts`. */
@Injectable()
export class ProductsRepository {
  constructor(private readonly db: TransactionalClient) {}

  findById(id: string): Promise<ProductRow | null> {
    return this.db.client.product.findUnique({ where: { id }, select: PRODUCT_SELECT });
  }

  /** At most 50 ids (validated): the cart and visible-row reconciliation lookup. */
  findByIds(ids: readonly string[]): Promise<ProductRow[]> {
    // bounded: ids are capped at 50 by productIdsSchema
    return this.db.client.product.findMany({
      where: { id: { in: [...ids] } },
      select: PRODUCT_SELECT,
    });
  }

  findActiveByBarcode(barcode: string): Promise<ProductRow | null> {
    return this.db.client.product.findFirst({
      where: { barcode, archivedAt: null },
      select: PRODUCT_SELECT,
    });
  }

  async findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<{ requestHash: Uint8Array; product: ProductRow } | null> {
    const row = await this.db.client.product.findUnique({
      where: { idempotencyKey },
      select: { ...PRODUCT_SELECT, requestHash: true },
    });
    if (row?.requestHash == null) {
      return null;
    }
    const { requestHash, ...product } = row;
    return { requestHash, product };
  }

  insert(data: Prisma.ProductUncheckedCreateInput): Promise<ProductRow> {
    return this.db.client.product.create({ data, select: PRODUCT_SELECT });
  }

  /** Optimistic update: a stale `version` matches no row (Prisma P2025 → CONFLICT). */
  update(
    id: string,
    version: number,
    data: Prisma.ProductUncheckedUpdateInput,
  ): Promise<ProductRow> {
    return this.db.client.product.update({
      where: { id, version },
      data: { ...data, version: { increment: 1 } },
      select: PRODUCT_SELECT,
    });
  }

  setArchivedAt(id: string, archivedAt: Date | null): Promise<ProductRow> {
    return this.db.client.product.update({
      where: { id },
      data: { archivedAt, version: { increment: 1 } },
      select: PRODUCT_SELECT,
    });
  }
}
