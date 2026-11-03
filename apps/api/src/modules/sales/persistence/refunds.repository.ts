import { Injectable } from '@nestjs/common';

import { TransactionalClient } from '../../../infrastructure/prisma/transactional-client';

import type { OrderStatus } from '@pos/contracts';
import type { Prisma } from '@pos/database';

export const REFUND_SELECT = {
  id: true,
  orderId: true,
  amount: true,
  billGstShare: true,
  settlement: true,
  reason: true,
  createdAt: true,
} as const satisfies Prisma.RefundSelect;

export type RefundRow = Prisma.RefundGetPayload<{ select: typeof REFUND_SELECT }>;

/** Refunds (DATABASE.md §4.12) and the order totals they change. Callers run inside UnitOfWork. */
@Injectable()
export class RefundsRepository {
  constructor(private readonly db: TransactionalClient) {}

  /** Row lock on the order first, so concurrent refunds of one bill serialize (FIN-18). */
  async lockOrder(orderId: string): Promise<boolean> {
    const rows = await this.db.client.$queryRaw<{ id: string }[]>`
      SELECT id FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`;
    return rows.length > 0;
  }

  insert(data: Prisma.RefundUncheckedCreateInput): Promise<RefundRow> {
    return this.db.client.refund.create({ data, select: REFUND_SELECT });
  }

  findByKey(idempotencyKey: string) {
    return this.db.client.refund.findUnique({
      where: { idempotencyKey },
      select: { ...REFUND_SELECT, requestHash: true },
    });
  }

  /** Adds the refunded quantities to the lines and the amount to the order (status, version). */
  async applyToOrder(
    orderId: string,
    lines: readonly { lineId: bigint; quantity: number }[],
    amount: string,
    status: OrderStatus,
  ): Promise<void> {
    for (const line of lines) {
      await this.db.client.orderLine.update({
        where: { id: line.lineId },
        data: { refundedQuantity: { increment: line.quantity } },
        select: { id: true },
      });
    }
    await this.db.client.order.update({
      where: { id: orderId },
      data: { refundedTotal: { increment: amount }, status, version: { increment: 1 } },
      select: { id: true },
    });
  }
}
