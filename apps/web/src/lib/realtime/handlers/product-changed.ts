import { ProductSnapshotFieldsFragment } from '@/graphql/fragments/product.fragments';

import { entityId, isNewer } from './versions';

import type { EventOf } from '../event-types';
import type { ProductSnapshotFieldsFragment as ProductSnapshot } from '@/graphql/__generated__/graphql';
import type { ApolloCache } from '@apollo/client';

/**
 * `product.changed`: patch a cached product in place. A new product is in no cached list yet and
 * appears on the next navigation (SYSTEM_DESIGN.md §5.9). Without a snapshot (it would exceed 1 KB)
 * the product is evicted, so mounted screens read it again. A category move drops the cached
 * category name, which the screen then refetches.
 */
export function applyProductChanged(
  cache: ApolloCache,
  event: EventOf<'ProductChangedEvent'>,
): void {
  if (event.productChange === 'CREATED') {
    return;
  }
  if (!isNewer(cache, 'Product', event.productId, event.version)) {
    return;
  }
  const id = entityId(cache, 'Product', event.productId);
  if (event.product === null) {
    cache.evict({ id });
    cache.gc();
    return;
  }
  const before = cache.readFragment({ id, fragment: ProductSnapshotFieldsFragment });
  const data: ProductSnapshot & { __typename: 'Product' } = {
    ...event.product,
    __typename: 'Product',
  };
  cache.writeFragment({ id, fragment: ProductSnapshotFieldsFragment, data });
  if (before?.categoryId !== event.product.categoryId) {
    cache.modify({ id, fields: { categoryName: (_value, { DELETE }) => DELETE } });
  }
}
