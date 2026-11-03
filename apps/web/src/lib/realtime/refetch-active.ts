import type { ApolloClient } from '@apollo/client';

/** Refetches the named queries that are currently mounted; others are left alone (never all). */
export async function refetchActive(
  client: ApolloClient,
  operationNames: readonly string[],
): Promise<void> {
  const names = new Set(operationNames);
  await client.refetchQueries({
    include: 'active',
    onQueryUpdated: (query) => names.has(query.queryName ?? ''),
  });
}
