'use client';

import {
  AlertTriangleIcon,
  BoxesIcon,
  CircleDollarSignIcon,
  Layers3Icon,
  PackageIcon,
  ReceiptTextIcon,
  WalletCardsIcon,
} from 'lucide-react';

import { formatRs } from '@pos/domain';

import { useLowStockCount } from '@/features/catalog';

import { StatTile } from './StatTile';

import type { DashboardLiveQuery } from '@/graphql/__generated__/graphql';

const PENDING = '—';

/**
 * The KPI row (F-06, `#0`): today's and period sales, products, category count and low stock.
 */
export function StatTiles({ live }: { live: DashboardLiveQuery['dashboard'] | undefined }) {
  const lowStock = useLowStockCount();
  const money = (value: string | undefined) => (value === undefined ? PENDING : formatRs(value));
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile
        label="Today's sales"
        value={money(live?.today.netSales)}
        note={live === undefined ? undefined : `After ${formatRs(live.today.refundTotal)} refunds`}
        icon={CircleDollarSignIcon}
        tone="sales"
      />
      <StatTile
        label="Today's orders"
        value={live === undefined ? PENDING : String(live.today.billCount)}
        icon={ReceiptTextIcon}
        tone="orders"
      />
      <StatTile
        label="Total products"
        value={live === undefined ? PENDING : String(live.inventory.productCount)}
        href="/products"
        icon={PackageIcon}
        tone="inventory"
      />
      <StatTile
        label="Low stock alerts"
        value={lowStock === null ? PENDING : String(lowStock)}
        href="/low-stock"
        icon={AlertTriangleIcon}
        tone="alerts"
      />
      <StatTile
        label="This week sales"
        value={money(live?.thisWeekSales)}
        icon={WalletCardsIcon}
        tone="sales"
      />
      <StatTile
        label="This month sales"
        value={money(live?.thisMonthSales)}
        icon={BoxesIcon}
        tone="reports"
      />
      <StatTile
        label="Total categories"
        value={live === undefined ? PENDING : String(live.categoryCount)}
        href="/categories"
        icon={Layers3Icon}
        tone="customers"
      />
    </div>
  );
}
