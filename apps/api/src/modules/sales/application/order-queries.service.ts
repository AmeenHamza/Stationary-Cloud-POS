import { Injectable } from '@nestjs/common';

import { ARCHIVE_WINDOW_DAYS } from '@pos/contracts';

import { toConnection } from '../../../common/pagination/keyset';
import { ClockService } from '../../../common/time/clock.service';
import { OrderListRepository, ORDER_SORT } from '../persistence/order-list.repository';
import { OrdersRepository } from '../persistence/orders.repository';

import { toOrderDetailView, toOrderView, type OrderDetailView, type OrderView } from './order-view';
import { ReceiptBuilder, type ReceiptView } from './receipt.builder';

import type { ConnectionValue } from '../../../common/pagination/connection.factory';
import type { OrdersArgs } from '@pos/validation';

const DAY_MS = 86_400_000;

/**
 * Bill reads (API.md §6.1, F-15): history newest first, 90 days unless `includeArchived` or a date
 * range is given (D-12, F-35); one bill with its lines and refunds so far; receipts for reprint;
 * `saleStatus` to confirm a sale whose response was lost (SYSTEM_DESIGN.md §3.4).
 */
@Injectable()
export class OrderQueriesService {
  constructor(
    private readonly orders: OrdersRepository,
    private readonly lists: OrderListRepository,
    private readonly receipts: ReceiptBuilder,
    private readonly clock: ClockService,
  ) {}

  async list(args: OrdersArgs): Promise<ConnectionValue<OrderView>> {
    const filter = args.filter ?? {};
    const windowed = filter.includeArchived !== true && filter.from == null && filter.to == null;
    const since = windowed
      ? new Date(this.clock.now().getTime() - ARCHIVE_WINDOW_DAYS * DAY_MS)
      : null;
    const listFilter = { ...filter, since };
    const rows = await this.lists.list(listFilter, args.first + 1, args.after);
    const page = toConnection(
      rows,
      args.first,
      ORDER_SORT,
      (row) => row.createdAt.toISOString(),
      () => this.lists.count(listFilter),
    );
    return { ...page, nodes: page.nodes.map(toOrderView) };
  }

  async detail(orderId: string): Promise<OrderDetailView | null> {
    const order = await this.orders.findById(orderId);
    return order && toOrderDetailView(order, await this.orders.refundedSoFar(orderId));
  }

  async receipt(orderId: string): Promise<ReceiptView> {
    return (await this.receipts.forOrder(orderId)).receipt;
  }

  /** The bill a key created, or null if that sale never reached the database. */
  async saleStatus(idempotencyKey: string): Promise<OrderView | null> {
    const found = await this.orders.findByKey(idempotencyKey);
    const order = found && (await this.orders.findById(found.id));
    return order && toOrderView(order);
  }
}
