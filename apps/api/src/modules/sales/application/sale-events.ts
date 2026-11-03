import { Injectable } from '@nestjs/common';

import { moneyText } from '../../../common/graphql/scalars';
import { OutboxService } from '../../../infrastructure/realtime/outbox.service';

import { toOrderView } from './order-view';

import type { OrderRow } from '../persistence/orders.repository';
import type { OrderStatus } from '@pos/contracts';

/** Sales events (API.md §7.2), added in the caller's transaction (ADR-009). No names or phones. */
@Injectable()
export class SaleEvents {
  constructor(private readonly outbox: OutboxService) {}

  /** Admins: dashboard tiles and the "N new orders" banner. */
  async orderCreated(order: OrderRow): Promise<void> {
    const view = toOrderView(order);
    await this.outbox.add('order.created', 'admin', {
      orderId: view.id,
      billNumber: view.billNumber,
      total: moneyText(view.total),
      paymentMethod: view.paymentMethod,
      businessDate: view.businessDate,
      createdAt: view.createdAt.toISOString(),
    });
  }

  /** Staff: refund status and totals patch open order lists. */
  async orderRefunded(order: {
    id: string;
    status: OrderStatus;
    refundedTotal: { toString: () => string };
    version: number;
  }): Promise<void> {
    await this.outbox.add('order.refunded', 'staff', {
      orderId: order.id,
      status: order.status,
      refundedTotal: moneyText(order.refundedTotal),
      version: order.version,
    });
  }
}
