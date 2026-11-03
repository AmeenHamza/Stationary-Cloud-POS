'use client';

import { useApolloClient, useQuery } from '@apollo/client/react';
import { RefreshCwIcon } from 'lucide-react';
import dynamic from 'next/dynamic';

import { formatBusinessDate } from '@pos/domain';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { userMessageOf } from '@/lib/errors/graphql-error';

import { DashboardLiveDocument } from '../graphql/dashboard.documents';

import { DashboardSkeleton } from './DashboardSkeleton';
import { StatTiles } from './StatTiles';
import { SummaryCards } from './SummaryCards';

/** The charts are their own chunk, loaded after the tiles (NETWORK_OPTIMIZATION.md §5). */
const DashboardHistory = dynamic(() => import('./DashboardHistory'), {
  loading: () => <p className="text-sm text-muted-foreground">Loading charts…</p>,
});

/**
 * Admin overview (F-06, F-07). The tiles and summaries are one live query, refetched (coalesced)
 * after sales, refunds, stock and khata events while this screen is open; the charts are a
 * separate query for closed periods. "Refresh" re-reads both on request. No polling.
 */
export function DashboardScreen() {
  const client = useApolloClient();
  const { data, previousData, error } = useQuery(DashboardLiveDocument, {
    fetchPolicy: 'cache-and-network',
  });
  const live = (data ?? previousData)?.dashboard;
  return (
    <>
      <PageHeader
        title="Overview"
        {...(live === undefined
          ? {}
          : { description: `Figures for ${formatBusinessDate(live.date)}` })}
        actions={
          <Button
            variant="outline"
            onClick={() =>
              void client.refetchQueries({ include: ['DashboardLive', 'DashboardHistory'] })
            }
          >
            <RefreshCwIcon /> Refresh
          </Button>
        }
      />
      {error !== undefined && live === undefined && (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {userMessageOf(error)}
        </p>
      )}
      {live === undefined ? (
        <DashboardSkeleton />
      ) : (
        <div className="grid gap-4">
          <StatTiles live={live} />
          <SummaryCards live={live} />
          <DashboardHistory today={live.date} />
        </div>
      )}
    </>
  );
}
