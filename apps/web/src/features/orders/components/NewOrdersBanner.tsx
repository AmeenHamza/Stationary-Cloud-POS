'use client';

import { BellIcon } from 'lucide-react';
import { useEffect, useSyncExternalStore } from 'react';

import { Button } from '@/components/ui/button';
import { newOrderCount, onNewOrders, resetNewOrders } from '@/lib/realtime/new-orders';

/**
 * "N new orders" (SYSTEM_DESIGN.md §5.9): sales made since this list was shown are counted from
 * `order.created` events; the list reloads only when asked, not on every sale.
 */
export function NewOrdersBanner({ onShow }: { onShow: () => void }) {
  const count = useSyncExternalStore(onNewOrders, newOrderCount, () => 0);
  useEffect(() => {
    resetNewOrders(); // count only the sales made while this list is open
  }, []);
  if (count === 0) {
    return null;
  }
  return (
    <div
      role="status"
      className="mb-4 flex items-center justify-between gap-2 rounded-lg border bg-primary/10 px-4 py-2"
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        <BellIcon className="size-4" aria-hidden />
        {count} new order{count === 1 ? '' : 's'}
      </span>
      <Button
        size="sm"
        onClick={() => {
          resetNewOrders();
          onShow();
        }}
      >
        Show
      </Button>
    </div>
  );
}
