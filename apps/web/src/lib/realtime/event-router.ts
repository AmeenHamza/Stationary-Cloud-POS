import { applyBalanceChanged } from './handlers/balance-changed';
import { applyCategoryChanged } from './handlers/category-changed';
import { applyImportProgressed } from './handlers/import-progressed';
import { applyOrderRefunded } from './handlers/order-refunded';
import { applyProductChanged } from './handlers/product-changed';
import { applyStockChanged } from './handlers/stock-changed';
import { LIVE_QUERIES } from './live-queries';
import { noteNewOrder } from './new-orders';

import type { ShopEvent } from './event-types';
import type { ApolloCache } from '@apollo/client';

export interface EventContext {
  cache: ApolloCache;
  /** Coalesced refetch of the named queries, only those that are mounted (SYSTEM_DESIGN.md §5.4). */
  refetchSoon: (operationNames: readonly string[]) => void;
  /** Full recovery: evict unused lists, refetch active queries (§5.5). */
  resync: () => void;
}

/**
 * Applies one event (API.md §7.2). Entity events patch the cache; aggregate signals refetch the
 * mounted queries they affect. Event types the current screens have no use for are ignored.
 */
export function routeEvent(event: ShopEvent, context: EventContext): void {
  switch (event.__typename) {
    case 'StockChangedEvent':
      applyStockChanged(context.cache, event);
      context.refetchSoon(LIVE_QUERIES.dashboard); // inventory value
      return;
    case 'ProductChangedEvent':
      applyProductChanged(context.cache, event);
      return;
    case 'CategoryChangedEvent':
      applyCategoryChanged(context.cache, event);
      // A rename or delete also changes the category shown on products (deletes move them).
      context.refetchSoon(
        event.categoryChange === 'CREATED'
          ? LIVE_QUERIES.categories
          : [...LIVE_QUERIES.categories, ...LIVE_QUERIES.products],
      );
      return;
    case 'CustomerBalanceChangedEvent':
      applyBalanceChanged(context.cache, event);
      context.refetchSoon(LIVE_QUERIES.customerLedger); // an open khata shows the new entry
      context.refetchSoon(LIVE_QUERIES.dashboard); // customer dues
      return;
    case 'VendorBalanceChangedEvent':
      applyBalanceChanged(context.cache, event);
      context.refetchSoon(LIVE_QUERIES.vendorLedger);
      return;
    case 'LowStockCountChangedEvent':
      context.refetchSoon(LIVE_QUERIES.lowStock);
      return;
    case 'OrderCreatedEvent':
      noteNewOrder(); // admins: the order history offers "N new orders" instead of refetching
      context.refetchSoon(LIVE_QUERIES.dashboard); // today's tiles, if the overview is open
      return;
    case 'OrderRefundedEvent':
      applyOrderRefunded(context.cache, event);
      context.refetchSoon(LIVE_QUERIES.dashboard);
      return;
    case 'ImportProgressedEvent':
      applyImportProgressed(context.cache, event);
      return;
    case 'CatalogBulkChangedEvent':
      context.resync(); // an import changed many products: lists read again once (API.md §7.2)
      return;
    case 'SettingsChangedEvent':
      context.refetchSoon(LIVE_QUERIES.settings);
      return;
    case 'ResyncRequiredEvent':
      context.resync();
      return;
    default:
      return;
  }
}
