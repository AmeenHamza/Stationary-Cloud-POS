import { Kind, type DocumentNode } from 'graphql';

import { LIST_ROOT_FIELDS } from './live-queries';

import type { ApolloClient } from '@apollo/client';

/** Root field names a query document reads (`products`, `lowStockCount`, …). */
function rootFields(document: DocumentNode): string[] {
  return document.definitions.flatMap((definition) =>
    definition.kind === Kind.OPERATION_DEFINITION
      ? definition.selectionSet.selections.flatMap((selection) =>
          selection.kind === Kind.FIELD ? [selection.name.value] : [],
        )
      : [],
  );
}

/**
 * Recovery after a reconnect or `system.resyncRequired` (SYSTEM_DESIGN.md §5.5): list fields no
 * mounted screen uses are evicted (read again when next shown), then only the active queries are
 * refetched, each a page of at most 50 rows or a small aggregate. Never a full-catalogue reload.
 */
export async function reconcile(client: ApolloClient): Promise<void> {
  const active = new Set(
    [...client.getObservableQueries('active')].flatMap((query) => rootFields(query.query)),
  );
  for (const fieldName of LIST_ROOT_FIELDS) {
    if (!active.has(fieldName)) {
      client.cache.evict({ id: 'ROOT_QUERY', fieldName });
    }
  }
  client.cache.gc();
  await client.refetchQueries({ include: 'active' });
}
