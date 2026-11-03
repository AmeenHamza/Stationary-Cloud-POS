/**
 * Realtime event catalog (API.md §7.2). `audience` decides which Redis channel carries the
 * event: `staff` (all signed-in users), `admin`, or `user` (one user, e.g. the import initiator).
 */
export type EventAudienceKind = 'staff' | 'admin' | 'user';

export interface EventDefinition {
  audience: EventAudienceKind;
  schemaVersion: number;
  /** GraphQL object type of the `shopEvents` payload; absent for server-internal events. */
  graphqlType?: string;
  /** Server-internal events are consumed by API instances and never forwarded to sockets. */
  internal?: true;
}

export const EVENT_DEFINITIONS = {
  'stock.changed': { audience: 'staff', schemaVersion: 1, graphqlType: 'StockChangedEvent' },
  'product.changed': { audience: 'staff', schemaVersion: 1, graphqlType: 'ProductChangedEvent' },
  'catalog.bulkChanged': {
    audience: 'staff',
    schemaVersion: 1,
    graphqlType: 'CatalogBulkChangedEvent',
  },
  'category.changed': { audience: 'staff', schemaVersion: 1, graphqlType: 'CategoryChangedEvent' },
  'lowStock.countChanged': {
    audience: 'admin',
    schemaVersion: 1,
    graphqlType: 'LowStockCountChangedEvent',
  },
  'order.created': { audience: 'admin', schemaVersion: 1, graphqlType: 'OrderCreatedEvent' },
  'order.refunded': { audience: 'staff', schemaVersion: 1, graphqlType: 'OrderRefundedEvent' },
  'customer.balanceChanged': {
    audience: 'staff',
    schemaVersion: 1,
    graphqlType: 'CustomerBalanceChangedEvent',
  },
  'vendor.balanceChanged': {
    audience: 'staff',
    schemaVersion: 1,
    graphqlType: 'VendorBalanceChangedEvent',
  },
  'settings.changed': { audience: 'staff', schemaVersion: 1, graphqlType: 'SettingsChangedEvent' },
  'import.progressed': {
    audience: 'user',
    schemaVersion: 1,
    graphqlType: 'ImportProgressedEvent',
  },
  'system.resyncRequired': {
    audience: 'user',
    schemaVersion: 1,
    graphqlType: 'ResyncRequiredEvent',
  },
  'session.revoked': { audience: 'user', schemaVersion: 1, internal: true },
} as const satisfies Record<string, EventDefinition>;

export type EventType = keyof typeof EVENT_DEFINITIONS;

export const EVENT_TYPES = Object.keys(EVENT_DEFINITIONS) as EventType[];

export function isEventType(value: string): value is EventType {
  return Object.hasOwn(EVENT_DEFINITIONS, value);
}
