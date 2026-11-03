import { ProductStockFragment } from '@/graphql/fragments/product.fragments';

import { entityId, isNewer } from './versions';

import type { EventOf } from '../event-types';
import type { ProductStockFragment as ProductStock } from '@/graphql/__generated__/graphql';
import type { ApolloCache } from '@apollo/client';

/** `stock.changed`: patch stock and the low-stock flag of cached products only (no fetches). */
export function applyStockChanged(cache: ApolloCache, event: EventOf<'StockChangedEvent'>): void {
  for (const item of event.items) {
    if (isNewer(cache, 'Product', item.productId, item.version)) {
      const data: ProductStock & { __typename: 'Product' } = {
        __typename: 'Product',
        id: item.productId,
        stockPieces: item.stockPieces,
        isLowStock: item.isLowStock,
        version: item.version,
      };
      cache.writeFragment({
        id: entityId(cache, 'Product', item.productId),
        fragment: ProductStockFragment,
        data,
      });
    }
  }
}
