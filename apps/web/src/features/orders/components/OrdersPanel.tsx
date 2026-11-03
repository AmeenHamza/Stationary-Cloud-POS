'use client';

import { useQuery } from '@apollo/client/react';
import { ReceiptTextIcon } from 'lucide-react';
import { useState } from 'react';

import { CursorPager } from '@/components/data/CursorPager';
import { EmptyState } from '@/components/data/EmptyState';
import { useCursorPages } from '@/hooks/useCursorPages';
import { userMessageOf } from '@/lib/errors/graphql-error';

import { OrdersDocument } from '../graphql/orders.documents';
import { useReprint } from '../hooks/useReprint';

import { NewOrdersBanner } from './NewOrdersBanner';
import { NO_ORDER_FILTER, OrderFilters, type OrderFilterState } from './OrderFilters';
import { OrdersTable } from './OrdersTable';
import { RefundDialog } from './RefundDialog';

/**
 * Order history with search, status, the 90-day archive toggle, refund and reprint (F-15, F-16,
 * F-35). Used by the admin Orders page and the terminal's Refund modal (F-28).
 */
export function OrdersPanel() {
  const pages = useCursorPages();
  const [filter, setFilter] = useState<OrderFilterState>(NO_ORDER_FILTER);
  const [refunding, setRefunding] = useState<string | null>(null);
  const printer = useReprint();
  const { data, previousData, error, refetch } = useQuery(OrdersDocument, {
    variables: {
      after: pages.after,
      filter: {
        ...(filter.billNumber === '' ? {} : { billNumberPrefix: filter.billNumber }),
        ...(filter.status === '' ? {} : { status: filter.status }),
        ...(filter.includeArchived ? { includeArchived: true } : {}),
      },
    },
  });
  const connection = (data ?? previousData)?.orders;
  return (
    <>
      <NewOrdersBanner
        onShow={() => {
          if (pages.hasPrevious) pages.reset();
          else void refetch();
        }}
      />
      <OrderFilters
        value={filter}
        onChange={(next) => {
          setFilter(next);
          pages.reset();
        }}
      />
      {error !== undefined && connection === undefined && (
        <p className="text-destructive">{userMessageOf(error)}</p>
      )}
      {connection?.nodes.length === 0 && (
        <EmptyState icon={ReceiptTextIcon}>No bills match.</EmptyState>
      )}
      {connection !== undefined && connection.nodes.length > 0 && (
        <OrdersTable
          orders={connection.nodes}
          onRefund={setRefunding}
          onReprint={(orderId) => void printer.reprint(orderId)}
        />
      )}
      {connection !== undefined && <CursorPager pages={pages} connection={connection} />}
      {refunding !== null && (
        <RefundDialog
          orderId={refunding}
          onClose={() => {
            setRefunding(null);
          }}
        />
      )}
      {printer.element}
    </>
  );
}
