import { Injectable } from '@nestjs/common';

import { keysetOrderBy, keysetWhere, type KeysetSort } from '../../../common/pagination/keyset';
import { toDateColumn } from '../../../common/time/date-column';
import { TransactionalClient } from '../../../infrastructure/prisma/transactional-client';

import { ORDER_SELECT, type OrderRow } from './orders.repository';

import type { OrderStatus } from '@pos/contracts';
import type { Prisma } from '@pos/database';

/** Order history: newest first, then id (index `orders_created_idx`). */
export const ORDER_SORT: KeysetSort = {
  name: 'CREATED_DESC',
  field: 'createdAt',
  direction: 'desc',
};

export interface OrderFilter {
  billNumberPrefix?: string | null | undefined;
  status?: OrderStatus | null | undefined;
  /** Business dates, inclusive. */
  from?: string | null | undefined;
  to?: string | null | undefined;
  customerId?: string | null | undefined;
  /** Lower bound on `created_at` (the 90-day window), or null for all (F-35). */
  since: Date | null;
}

function where(filter: OrderFilter): Prisma.OrderWhereInput {
  return {
    ...(filter.billNumberPrefix == null
      ? {}
      : { billNumber: { contains: filter.billNumberPrefix, mode: 'insensitive' } }),
    ...(filter.status == null ? {} : { status: filter.status }),
    ...(filter.customerId == null ? {} : { customerId: filter.customerId }),
    ...(filter.from == null && filter.to == null
      ? {}
      : {
          businessDate: {
            ...(filter.from == null ? {} : { gte: toDateColumn(filter.from) }),
            ...(filter.to == null ? {} : { lte: toDateColumn(filter.to) }),
          },
        }),
    ...(filter.since === null ? {} : { createdAt: { gte: filter.since } }),
  };
}

/** Order lists (F-15): keyset pages; the total is a COUNT run only when selected. */
@Injectable()
export class OrderListRepository {
  constructor(private readonly db: TransactionalClient) {}

  list(filter: OrderFilter, take: number, after: string | null | undefined): Promise<OrderRow[]> {
    const cursor = keysetWhere(ORDER_SORT, after) as Prisma.OrderWhereInput | undefined;
    return this.db.client.order.findMany({
      where: { AND: [where(filter), ...(cursor === undefined ? [] : [cursor])] },
      orderBy: keysetOrderBy(ORDER_SORT),
      take,
      select: ORDER_SELECT,
    });
  }

  count(filter: OrderFilter): Promise<number> {
    return this.db.client.order.count({ where: where(filter) });
  }
}
