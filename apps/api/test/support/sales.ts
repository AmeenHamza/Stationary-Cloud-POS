import { randomUUID } from 'node:crypto';

import { normalizeNameKey } from '@pos/domain';

import { asUser } from './staff';

import type { RoleHarness } from './roles';
import type { AppPrismaClient } from '../../src/infrastructure/prisma/prisma.module';

export const CREATE_SALE = `mutation Sale($input: CreateSaleInput!) {
  createSale(input: $input) {
    replayed
    order { id billNumber businessDate total subtotal discountTotal productTaxTotal billGstAmount status version }
    receipt { billNumber cashierName customerName customerBalance total lines { name quantity unitPrice lineTotal } }
    stockWarnings { productId productName stockAfter }
  }
}`;

export const ORDER = `query Order($id: ID!) {
  order(id: $id) {
    id billNumber total refundedTotal status version refundedGstShare billGstAmount
    lines { id quantity refundedQuantity lineNet lineTax refundedAmount piecesPerUnit saleUnit }
  }
}`;

export const REFUND = `mutation Refund($input: RefundOrderInput!) {
  refundOrder(input: $input) {
    replayed
    order { id status refundedTotal version lines { id refundedQuantity } }
    refund { id amount billGstShare settlement }
  }
}`;

export interface SaleResult {
  createSale: {
    replayed: boolean;
    order: { id: string; billNumber: string; total: string; status: string; version: number };
    receipt: { billNumber: string; customerName: string | null; customerBalance: string | null };
    stockWarnings: { productId: string; productName: string; stockAfter: number }[];
  };
}

export interface RefundResult {
  refundOrder: {
    replayed: boolean;
    order: { status: string; refundedTotal: string };
    refund: { amount: string; billGstShare: string; settlement: string };
  };
}

/** Inserts an active product directly (fixture); returns its id. */
export async function seedProduct(
  prisma: AppPrismaClient,
  fields: {
    name?: string;
    price: string;
    stock?: number;
    boxPrice?: string;
    piecesPerBox?: number;
    taxRate?: string;
  },
): Promise<string> {
  const id = randomUUID();
  const name = fields.name ?? `Item ${id.slice(0, 6)}`;
  await prisma.product.create({
    data: {
      id,
      name,
      nameKey: normalizeNameKey(name),
      salePrice: fields.price,
      boxPrice: fields.boxPrice ?? null,
      piecesPerBox: fields.piecesPerBox ?? 1,
      taxRate: fields.taxRate ?? '0',
      lowStockThresholdPieces: 5,
      stockPieces: fields.stock ?? 100,
    },
    select: { id: true },
  });
  return id;
}

/** A `createSale` input: one PIECE line per product unless lines are given; override anything. */
export function saleInput(
  lines: { productId: string; quantity?: number; unit?: 'PIECE' | 'BOX' }[],
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    idempotencyKey: randomUUID(),
    lines: lines.map((line) => ({ unit: 'PIECE', quantity: 1, ...line })),
    discount: { type: 'NONE' },
    billGst: { applied: false },
    paymentMethod: 'CASH',
    ...overrides,
  };
}

/** `createSale` as the cashier. */
export const sellAsCashier = (t: RoleHarness, input: Record<string, unknown>) =>
  asUser<SaleResult>(t.h.url, t.cashier, CREATE_SALE, { input });

export async function stockOf(prisma: AppPrismaClient, productId: string): Promise<number> {
  const row = await prisma.product.findUnique({
    where: { id: productId },
    select: { stockPieces: true },
  });
  return row?.stockPieces ?? Number.NaN;
}
