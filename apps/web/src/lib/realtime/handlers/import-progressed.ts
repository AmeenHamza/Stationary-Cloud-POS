import { ImportJobProgressFragment } from '@/graphql/fragments/import.fragments';

import type { EventOf } from '../event-types';
import type { ImportJobProgressFragment as ImportJobProgress } from '@/graphql/__generated__/graphql';
import type { ApolloCache } from '@apollo/client';

/**
 * `import.progressed` (the importing admin only): patch the cached job. Counters only grow, so an
 * event older than what the cache holds is ignored; a job nobody has loaded is not created.
 */
export function applyImportProgressed(
  cache: ApolloCache,
  event: EventOf<'ImportProgressedEvent'>,
): void {
  const id = cache.identify({ __typename: 'ImportJob', id: event.importJobId });
  const cached =
    id === undefined ? null : cache.readFragment({ id, fragment: ImportJobProgressFragment });
  if (id === undefined || cached == null || event.processedRows < cached.processedRows) {
    return;
  }
  const data: ImportJobProgress & { __typename: 'ImportJob' } = {
    __typename: 'ImportJob',
    id: event.importJobId,
    status: event.importStatus,
    processedRows: event.processedRows,
    totalRows: event.totalRows,
    succeededRows: event.succeededRows,
    failedRows: event.failedRows,
  };
  cache.writeFragment({ id, fragment: ImportJobProgressFragment, data });
}
