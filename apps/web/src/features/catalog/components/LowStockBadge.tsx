'use client';

import { Badge } from '@/components/ui/badge';

import { useLowStockCount } from '../hooks/useLowStockCount';

/** Sidebar count on every admin page (F-13): one COUNT, refreshed by live events only. */
export function LowStockBadge() {
  const count = useLowStockCount() ?? 0;
  if (count === 0) {
    return null;
  }
  return (
    <Badge variant="destructive" data-testid="low-stock-badge" aria-label={`${String(count)} low`}>
      {count}
    </Badge>
  );
}
