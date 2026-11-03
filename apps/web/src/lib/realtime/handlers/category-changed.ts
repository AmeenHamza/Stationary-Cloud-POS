import { CategorySnapshotFieldsFragment } from '@/graphql/fragments/category.fragments';

import { entityId, isNewer } from './versions';

import type { EventOf } from '../event-types';
import type { CategorySnapshotFieldsFragment as CategorySnapshot } from '@/graphql/__generated__/graphql';
import type { ApolloCache } from '@apollo/client';

/** `category.changed`: patch or evict the cached category; counts come from the coalesced refetch. */
export function applyCategoryChanged(
  cache: ApolloCache,
  event: EventOf<'CategoryChangedEvent'>,
): void {
  const id = entityId(cache, 'Category', event.categoryId);
  if (event.categoryChange === 'DELETED') {
    cache.evict({ id });
    cache.gc();
    return;
  }
  const category = event.category;
  if (category !== null && isNewer(cache, 'Category', category.id, category.version)) {
    const data: CategorySnapshot & { __typename: 'Category' } = {
      ...category,
      __typename: 'Category',
    };
    cache.writeFragment({ id, fragment: CategorySnapshotFieldsFragment, data });
  }
}
