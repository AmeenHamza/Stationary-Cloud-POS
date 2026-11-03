import { PageHeader } from '@/components/layout/PageHeader';

import { OrdersPanel } from './OrdersPanel';

/** Admin order history (F-15, FEATURES.md §3.7). */
export function OrdersScreen() {
  return (
    <>
      <PageHeader title="Order history" description="Bills, refunds and reprints." />
      <OrdersPanel />
    </>
  );
}
