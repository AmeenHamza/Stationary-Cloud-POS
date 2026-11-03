import { OrdersScreen } from '@/features/orders';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Orders' };

/** Order history, refunds and reprints (F-15, F-16, F-35). */
export default function OrdersPage() {
  return <OrdersScreen />;
}
