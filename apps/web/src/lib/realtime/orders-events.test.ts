import { InMemoryCache } from '@apollo/client';
import { describe, expect, it, vi } from 'vitest';

import {
  OrderRefundStateFragment,
  OrderRowFieldsFragment,
} from '@/graphql/fragments/order.fragments';

import { routeEvent, type EventContext } from './event-router';
import { LIVE_QUERIES } from './live-queries';
import { newOrderCount, onNewOrders, resetNewOrders } from './new-orders';

import type { EventOf } from './event-types';

const ORDER = {
  __typename: 'Order' as const,
  id: 'o1',
  status: 'COMPLETED' as const,
  refundedTotal: '0.00',
  version: 1,
};

function context(cache: InMemoryCache): EventContext {
  return { cache, refetchSoon: vi.fn(), resync: vi.fn() };
}

/** The order history is never refetched; only the overview's live tiles, if mounted. */
function onlyDashboardRefetched(ctx: EventContext): void {
  for (const call of vi.mocked(ctx.refetchSoon).mock.calls) {
    expect(call[0]).toEqual(LIVE_QUERIES.dashboard);
  }
}

const refunded = (version: number): EventOf<'OrderRefundedEvent'> => ({
  __typename: 'OrderRefundedEvent',
  seq: String(version),
  type: 'order.refunded',
  orderId: 'o1',
  status: 'PARTIALLY_REFUNDED',
  refundedTotal: '40.00',
  version,
});

describe('order events (API.md §7.2, SYSTEM_DESIGN.md §5.9)', () => {
  it('order.refunded patches a cached bill when newer and ignores stale or unseen ones', () => {
    const cache = new InMemoryCache();
    cache.writeFragment({ id: 'Order:o1', fragment: OrderRefundStateFragment, data: ORDER });
    const ctx = context(cache);
    routeEvent(refunded(2), ctx);
    const read = () => cache.readFragment({ id: 'Order:o1', fragment: OrderRefundStateFragment });
    expect(read()).toMatchObject({ status: 'PARTIALLY_REFUNDED', refundedTotal: '40.00' });
    routeEvent({ ...refunded(1), status: 'COMPLETED' }, ctx);
    expect(read()?.status).toBe('PARTIALLY_REFUNDED');
    routeEvent({ ...refunded(3), orderId: 'unseen' }, ctx);
    expect(cache.extract()['Order:unseen']).toBeUndefined();
    onlyDashboardRefetched(ctx);
  });

  it('order.refunded updates a row the order history loaded (its fragment carries version)', () => {
    const cache = new InMemoryCache();
    const row = {
      ...ORDER,
      billNumber: 'ORD-20261101-001',
      createdAt: '2026-11-01T05:00:00.000Z',
      paymentMethod: 'CASH' as const,
      subtotal: '120.00',
      discountType: 'NONE' as const,
      discountValue: '0.00',
      discountTotal: '0.00',
      billGstAmount: '0.00',
      total: '120.00',
    };
    cache.writeFragment({ id: 'Order:o1', fragment: OrderRowFieldsFragment, data: row });
    routeEvent(refunded(2), context(cache));
    expect(cache.readFragment({ id: 'Order:o1', fragment: OrderRowFieldsFragment })).toMatchObject({
      status: 'PARTIALLY_REFUNDED',
      refundedTotal: '40.00',
      version: 2,
    });
  });

  it('order.created counts new orders for the banner and refreshes only the overview', () => {
    resetNewOrders();
    const seen: number[] = [];
    const stop = onNewOrders(() => seen.push(newOrderCount()));
    const ctx = context(new InMemoryCache());
    const created: EventOf<'OrderCreatedEvent'> = {
      __typename: 'OrderCreatedEvent',
      seq: '9',
      type: 'order.created',
      orderId: 'o2',
    };
    routeEvent(created, ctx);
    routeEvent({ ...created, seq: '10' }, ctx);
    expect(seen).toEqual([1, 2]);
    resetNewOrders();
    expect(newOrderCount()).toBe(0);
    stop();
    onlyDashboardRefetched(ctx);
  });
});
