'use client';

import { useQuery } from '@apollo/client/react';
import { useMemo, useState } from 'react';

import { addDays, formatRs } from '@pos/domain';

import { ColumnChart } from '@/components/charts/ColumnChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';

import { dayLabel } from '../dashboard-labels';
import { DashboardHistoryDocument } from '../graphql/dashboard.documents';

import { MonthlySalesCard } from './MonthlySalesCard';
import { ProductFilter, type PickedProduct } from './ProductFilter';
import { ProductRanking } from './ProductRanking';

import type { DashboardHistoryQuery } from '@/graphql/__generated__/graphql';

type DailyPoint = DashboardHistoryQuery['dashboard']['dailySales'][number];
type PeriodKey = 'LAST_7_DAYS' | 'WEEK_1' | 'WEEK_2' | 'WEEK_3' | 'WEEK_4';

const PERIOD_LABEL: Readonly<Record<PeriodKey, string>> = {
  LAST_7_DAYS: 'Last 7 days',
  WEEK_1: '1st week of this month',
  WEEK_2: '2nd week of this month',
  WEEK_3: '3rd week of this month',
  WEEK_4: '4th week of this month',
};

function HistorySkeleton() {
  return (
    <div className="grid gap-3 lg:grid-cols-2" aria-hidden>
      <Card className="lg:col-span-2">
        <CardHeader>
          <Skeleton className="h-5 w-56" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-56 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

function weekDates(today: string, week: 1 | 2 | 3 | 4): string[] {
  const base = `${today.slice(0, 8)}01`;
  const start = addDays(base, (week - 1) * 7);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

function pointsForPeriod(points: readonly DailyPoint[], today: string, period: PeriodKey) {
  if (period === 'LAST_7_DAYS') {
    return points.slice(-7);
  }
  const week = Number.parseInt(period.slice(-1), 10) as 1 | 2 | 3 | 4;
  const byDate = new Map(points.map((row) => [row.date, row.total]));
  return weekDates(today, week).map((date) => ({ date, total: byDate.get(date) ?? '0' }));
}

/**
 * Sales analytics (F-07, `#6`–`#8`), loaded after the tiles as its own chunk: the year by month
 * against last year, the last 7 days by default (or a month week) and the 30-day product rankings.
 */
export default function DashboardHistory({ today }: { today: string }) {
  const thisYear = Number.parseInt(today.slice(0, 4), 10);
  const [year, setYear] = useState(thisYear);
  const [product, setProduct] = useState<PickedProduct | null>(null);
  const [period, setPeriod] = useState<PeriodKey>('LAST_7_DAYS');
  const { data, previousData } = useQuery(DashboardHistoryDocument, {
    variables: { year, productId: product?.id ?? null },
  });
  const history = (data ?? previousData)?.dashboard;
  const periodPoints = useMemo(
    () => (history === undefined ? [] : pointsForPeriod(history.dailySales, today, period)),
    [history, period, today],
  );
  if (history === undefined) {
    return <HistorySkeleton />;
  }
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <MonthlySalesCard months={history.monthlySales} year={year} today={today} onYear={setYear} />
      <Card>
        <CardHeader className="grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>
              {PERIOD_LABEL[period]}
              {product === null ? '' : ` · ${product.name}`}
            </CardTitle>
            <NativeSelect
              className="h-8 w-48"
              aria-label="Sales period"
              value={period}
              onChange={(event) => {
                setPeriod(event.target.value as PeriodKey);
              }}
            >
              <option value="LAST_7_DAYS">Last 7 days</option>
              <option value="WEEK_1">1st week of this month</option>
              <option value="WEEK_2">2nd week of this month</option>
              <option value="WEEK_3">3rd week of this month</option>
              <option value="WEEK_4">4th week of this month</option>
            </NativeSelect>
          </div>
          <ProductFilter value={product} onChange={setProduct} />
        </CardHeader>
        <CardContent>
          <ColumnChart
            title={`Net sales, ${PERIOD_LABEL[period].toLowerCase()}`}
            labels={periodPoints.map((row) => dayLabel(row.date))}
            format={formatRs}
            series={[
              {
                name: 'Net sales',
                tone: 'accent',
                values: periodPoints.map((row) => row.total),
              },
            ]}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Products, last 30 days</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 xl:grid-cols-2">
          <ProductRanking title="Highest selling" rows={history.highest} />
          <ProductRanking title="Least selling" rows={history.lowest} />
        </CardContent>
      </Card>
    </div>
  );
}
