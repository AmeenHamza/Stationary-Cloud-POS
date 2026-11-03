import { formatRs } from '@pos/domain';

import type { DashboardHistoryQuery } from '@/graphql/__generated__/graphql';

type Row = DashboardHistoryQuery['dashboard']['highest'][number];

/** Highest or least selling products by units (pieces) over the last 30 days (Q18, Q36). */
export function ProductRanking({ title, rows }: { title: string; rows: readonly Row[] }) {
  return (
    <section className="grid gap-2" aria-label={title}>
      <h3 className="text-sm font-medium">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sales in the last 30 days.</p>
      ) : (
        <ol className="grid gap-2 text-sm">
          {rows.map((row, index) => (
            <li key={row.productId} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1">
              <span className="min-w-0 truncate">
                <span className="mr-2 text-muted-foreground tabular-nums">{index + 1}.</span>
                {row.name}
              </span>
              <span className="text-right tabular-nums">
                {row.units} pcs
              </span>
              <span className="col-span-2 text-right text-xs text-muted-foreground tabular-nums">
                {formatRs(row.total)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
