import { graphql } from '@/graphql/__generated__';

import type { ApolloCache } from '@apollo/client';

const ProductVersionFragment = graphql(`
  fragment ProductVersion on Product {
    version
  }
`);

const CategoryVersionFragment = graphql(`
  fragment CategoryVersion on Category {
    version
  }
`);

export type LiveEntity = 'Product' | 'Category' | 'Customer' | 'Vendor' | 'Order';

/** The cached `version` of each live entity type, so one check serves every handler. */
const VERSION_FRAGMENTS = {
  Product: ProductVersionFragment,
  Category: CategoryVersionFragment,
  Customer: graphql(`
    fragment CustomerVersion on Customer {
      version
    }
  `),
  Vendor: graphql(`
    fragment VendorVersion on Vendor {
      version
    }
  `),
  Order: graphql(`
    fragment OrderVersion on Order {
      version
    }
  `),
} as const;

/** The normalized cache id of an entity (`Product:<id>`). */
export function entityId(cache: ApolloCache, typename: LiveEntity, id: string): string {
  return cache.identify({ __typename: typename, id }) ?? `${typename}:${id}`;
}

/**
 * True only when the entity is cached and the event is newer (RT-07): entities nobody has loaded
 * are ignored, and an event arriving after a fresher read never overwrites it.
 */
export function isNewer(
  cache: ApolloCache,
  typename: LiveEntity,
  id: string,
  version: number,
): boolean {
  const cacheId = entityId(cache, typename, id);
  const cached: { version: number } | null = cache.readFragment({
    id: cacheId,
    fragment: VERSION_FRAGMENTS[typename],
  });
  return cached != null && version > cached.version;
}
