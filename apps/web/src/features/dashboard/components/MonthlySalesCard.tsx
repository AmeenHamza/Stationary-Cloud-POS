import { Decimal, formatRs, sum } from '@pos/domain';

import { ColumnChart } from '@/components/charts/ColumnChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';

import { monthLabel } from '../dashboard-labels';

import type { DashboardHistoryQuery } from '@/graphql/__generated__/graphql';

type Month = DashboardHistoryQuery['dashboard']['monthlySales'][number];

/**
 * "Sales Analytics" (`#6`): the year's net sales by month (accent) against the year before
 * (gray context), the year total, and this month against the same month last year.
 */
export function MonthlySalesCard({
  months,
  year,
  today,
  onYear,
}: {
  months: readonly Month[];
  year: number;
  today: string;
  onYear: (year: number) => void;
}) {
  const thisYear = Number.parseInt(today.slice(0, 4), 10);
  const yearTotal = sum(months.map((row) => new Decimal(row.total)));
  const current =
    year === thisYear ? months[Number.parseInt(today.slice(5, 7), 10) - 1] : undefined;
  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>
          Sales analytics · {formatRs(yearTotal)} in {year}
        </CardTitle>
        <NativeSelect
          className="h-8 w-28"
          aria-label="Year"
          value={String(year)}
          onChange={(event) => {
            onYear(Number.parseInt(event.target.value, 10));
          }}
        >
          {[thisYear, thisYear - 1, thisYear - 2].map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </NativeSelect>
      </CardHeader>
      <CardContent className="grid gap-2">
        {current !== undefined && (
          <p className="text-sm text-muted-foreground">
            {monthLabel(current.month)}: {formatRs(current.total)} against{' '}
            {formatRs(current.sameMonthLastYear)} a year earlier
          </p>
        )}
        <ColumnChart
          title={`Net sales by month, ${String(year)} and ${String(year - 1)}`}
          labels={months.map((row) => monthLabel(row.month))}
          format={formatRs}
          series={[
            { name: String(year), tone: 'accent', values: months.map((row) => row.total) },
            {
              name: String(year - 1),
              tone: 'context',
              values: months.map((row) => row.sameMonthLastYear),
            },
          ]}
        />
      </CardContent>
    </Card>
  );
}
