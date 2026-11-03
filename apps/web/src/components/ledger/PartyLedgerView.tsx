'use client';

import { BookOpenIcon } from 'lucide-react';

import { CursorPager, type PagedConnection } from '@/components/data/CursorPager';
import { EmptyState } from '@/components/data/EmptyState';
import { ToggleField } from '@/components/forms/ToggleField';
import { Badge } from '@/components/ui/badge';
import { userMessageOf } from '@/lib/errors/graphql-error';

import { BalanceText } from './BalanceText';
import { LedgerTable } from './LedgerTable';

import type { BalanceLabels, LedgerEntry, PartySummary } from './khata-labels';
import type { CursorPages } from '@/hooks/useCursorPages';
import type { ReactNode } from 'react';

/**
 * One party's khata (FEATURES.md §3.9 `#20`, §3.10 `#24`): header with the outstanding balance and
 * the actions passed in, then the ledger newest first. Entries older than 90 days appear only with
 * "Show older entries" (D-12, F-35).
 */
export function PartyLedgerView({
  party,
  labels,
  balanceTitle,
  actions,
  ledger,
  error,
  pages,
  includeArchived,
  onIncludeArchived,
  typeLabels,
}: {
  party: PartySummary;
  labels: BalanceLabels;
  balanceTitle: string;
  actions: ReactNode;
  ledger: (PagedConnection & { nodes: readonly LedgerEntry[] }) | undefined;
  error: unknown;
  pages: CursorPages;
  includeArchived: boolean;
  onIncludeArchived: (value: boolean) => void;
  typeLabels: Readonly<Record<string, string>>;
}) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border bg-card p-4">
        <div className="grid gap-1">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            {party.name}
            {party.archivedAt !== null && <Badge variant="muted">Archived</Badge>}
          </h2>
          <p className="text-sm text-muted-foreground">{party.phone ?? 'No phone'}</p>
          {party.detail != null && <p className="text-sm text-muted-foreground">{party.detail}</p>}
        </div>
        <div className="grid justify-items-end gap-1 text-right">
          <span className="text-sm text-muted-foreground">{balanceTitle}</span>
          <BalanceText balance={party.balance} labels={labels} className="text-2xl" />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">{actions}</div>
        <ToggleField
          label="Show entries older than 90 days"
          checked={includeArchived}
          onChange={onIncludeArchived}
        />
      </div>
      {error !== undefined && <p className="text-destructive">{userMessageOf(error)}</p>}
      {ledger?.nodes.length === 0 && (
        <EmptyState icon={BookOpenIcon}>No khata entries in this period.</EmptyState>
      )}
      {ledger !== undefined && ledger.nodes.length > 0 && (
        <div>
          <div className="rounded-xl border bg-card">
            <LedgerTable entries={ledger.nodes} typeLabels={typeLabels} balanceHeading="Balance" />
          </div>
          <CursorPager pages={pages} connection={ledger} />
        </div>
      )}
    </div>
  );
}
