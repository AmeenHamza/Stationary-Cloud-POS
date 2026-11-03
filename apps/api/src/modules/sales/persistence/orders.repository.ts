import { Injectable } from '@nestjs/common';

import { TransactionalClient } from '../../../infrastructure/prisma/transactional-client';

import type { Prisma } from '@pos/database';

/** The bill header (DATABASE.md §4.10) with the customer's name for lists and receipts. */
export const ORDER_SELECT = {
  id: true,
  billNumber: true,
  businessDate: true,
  cashierName: true,
  customerId: true,
  paymentMethod: true,
  discountType: true,
  discountValue: true,
  subtotal: true,
  discountTotal: true,
  productTaxTotal: true,
  billGstRate: true,
  billGstAmount: true,
  total: true,
  refundedTotal: true,
  status: true,
  createdAt: true,
  version: true,
  customer: { select: { name: true } },
} as const satisfies Prisma.OrderSelect;

export const LINE_SELECT = {
  id: true,
  lineNo: true,
  productId: true,
  productName: true,
  productNameUrdu: true,
  barcode: true,
  saleUnit: true,
  piecesPerUnit: true,
  quantity: true,
  unitPrice: true,
  taxRate: true,
  lineGross: true,
  lineDiscount: true,
  lineNet: true,
  lineTax: true,
  refundedQuantity: true,
} as const satisfies Prisma.OrderLineSelect;

export type OrderRow = Prisma.OrderGetPayload<{ select: typeof ORDER_SELECT }>;
export type OrderLineRow = Prisma.OrderLineGetPayload<{ select: typeof LINE_SELECT }>;
export type OrderDetailRow = OrderRow & { lines: OrderLineRow[] };

const DETAIL_SELECT = {
  ...ORDER_SELECT,
  lines: { select: LINE_SELECT, orderBy: { lineNo: 'asc' } },
} as const satisfies Prisma.OrderSelect;

/** Orders and their lines; bills are immutable apart from refund totals (D-12). */
@Injectable()
export class OrdersRepository {
  constructor(private readonly db: TransactionalClient) {}

  /** Inserts the header and all lines in one statement pair (lines ≤ 100). */
  insert(data: Prisma.OrderUncheckedCreateInput): Promise<OrderDetailRow> {
    return this.db.client.order.create({ data, select: DETAIL_SELECT });
  }

  findById(id: string): Promise<OrderDetailRow | null> {
    return this.db.client.order.findUnique({ where: { id }, select: DETAIL_SELECT });
  }

  findByKey(
    idempotencyKey: string,
  ): Promise<{ id: string; requestHash: Uint8Array | null } | null> {
    return this.db.client.order.findUnique({
      where: { idempotencyKey },
      select: { id: true, requestHash: true },
    });
  }

  /** The cashier name snapshot stored on the bill (A-07). */
  async cashierName(userId: string): Promise<string> {
    const user = await this.db.client.user.findUnique({
      where: { id: userId },
      select: { fullName: true },
    });
    return user?.fullName ?? 'Unknown';
  }

  /** The Udhaar customer's balance right after this bill (receipts and reprints). */
  async creditBalanceAfter(orderId: string): Promise<string | null> {
    const entry = await this.db.client.customerLedgerEntry.findFirst({
      where: { orderId, type: 'CREDIT_SALE' },
      select: { balanceAfter: true },
    });
    return entry?.balanceAfter.toString() ?? null;
  }

  /** Σ refunded amount per line and Σ Bill GST returned, for the refund maths (A-06). */
  async refundedSoFar(orderId: string) {
    const [lines, gst] = await Promise.all([
      this.db.client.refundLine.groupBy({
        by: ['orderLineId'],
        where: { refund: { orderId } },
        _sum: { amount: true },
      }),
      this.db.client.refund.aggregate({ where: { orderId }, _sum: { billGstShare: true } }),
    ]);
    return {
      byLine: new Map(lines.map((row) => [row.orderLineId, row._sum.amount?.toString() ?? '0'])),
      gstShare: gst._sum.billGstShare?.toString() ?? '0',
    };
  }
}
