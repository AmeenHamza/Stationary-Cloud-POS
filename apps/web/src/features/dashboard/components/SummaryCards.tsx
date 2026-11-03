'use client';

import { formatRs } from '@pos/domain';

import { RankedBars } from '@/components/charts/RankedBars';
import { PAYMENT_METHOD_LABEL } from '@/components/ledger/khata-labels';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { DashboardLiveQuery } from '@/graphql/__generated__/graphql';

type MethodRow = DashboardLiveQuery['dashboard']['paymentMethodsToday'][number];

const METHOD_BAR_CLASS: Readonly<Record<string, string>> = {
  CASH: 'bg-emerald-500',
  CARD: 'bg-blue-500',
  JAZZCASH: 'bg-violet-500',
  BANK_TRANSFER: 'bg-amber-500',
  UDHAAR: 'bg-cyan-500',
  EASYPAISA: 'bg-rose-500',
};

function PaymentMethodCard({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: readonly MethodRow[];
  empty: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <RankedBars
            title={title}
            format={formatRs}
            barClassByKey={METHOD_BAR_CLASS}
            bars={rows.map((row) => ({
              key: row.method,
              label: PAYMENT_METHOD_LABEL[row.method],
              value: row.total,
              detail: `${String(row.billCount)} bill${row.billCount === 1 ? '' : 's'}`,
            }))}
          />
        )}
      </CardContent>
    </Card>
  );
}

/** Payment method split for today, this week and this month. */
export function SummaryCards({ live }: { live: DashboardLiveQuery['dashboard'] }) {
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <PaymentMethodCard
        title="Payment methods, today"
        rows={live.paymentMethodsToday}
        empty="No sales today."
      />
      <PaymentMethodCard
        title="Payment methods, this week"
        rows={live.paymentMethodsThisWeek}
        empty="No sales this week yet."
      />
      <PaymentMethodCard
        title="Payment methods, this month"
        rows={live.paymentMethodsThisMonth}
        empty="No sales this month yet."
      />
    </div>
  );
}
