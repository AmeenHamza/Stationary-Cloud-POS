import { graphql } from '@/graphql/__generated__';

/** A category card or option. `productCount` is refetched, never patched (one grouped query). */
export const CategoryFieldsFragment = graphql(`
  fragment CategoryFields on Category {
    id
    name
    iconEmoji
    description
    version
    productCount
  }
`);

/** The fields a `category.changed` snapshot carries. */
export const CategorySnapshotFieldsFragment = graphql(`
  fragment CategorySnapshotFields on Category {
    id
    name
    iconEmoji
    description
    version
  }
`);
