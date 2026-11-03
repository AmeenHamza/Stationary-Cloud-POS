import type { Reference, TypePolicies } from '@apollo/client';

/**
 * Cache rules (ADR-005). `productsByIds` answers from cached products when every one is there, so
 * the cart reads products the grid or a scan already loaded without a request; only products the
 * cache lacks (a cart restored after a reload) are fetched (SYSTEM_DESIGN.md §3.1).
 */
export const TYPE_POLICIES: TypePolicies = {
  // The shop profile has no id: one cached object, so mutation results replace it in place.
  ShopSettings: { keyFields: [] },
  Query: {
    fields: {
      productsByIds: {
        read(_existing, { args, toReference, canRead }) {
          const ids: unknown = args?.['ids'];
          if (!Array.isArray(ids)) {
            return undefined;
          }
          const refs: (Reference | undefined)[] = ids.map((id: unknown) =>
            typeof id === 'string' ? toReference({ __typename: 'Product', id }) : undefined,
          );
          return refs.every((ref) => ref !== undefined && canRead(ref)) ? refs : undefined;
        },
      },
    },
  },
};
