/**
 * Operation names the realtime layer refetches (when mounted) after aggregate signals. They name
 * documents in `features/`, which `lib/` cannot import; `live-queries.test.ts` keeps them in step.
 */
export const LIVE_QUERIES = {
  categories: ['Categories', 'CategoryOptions'],
  products: ['Products', 'TerminalProducts'],
  lowStock: ['LowStockCount', 'LowStockProducts'],
  settings: ['ShopSettings', 'AiKeyStatus'],
  customerLedger: ['CustomerLedger'],
  vendorLedger: ['VendorLedger'],
  dashboard: ['DashboardLive'],
} as const satisfies Record<string, readonly string[]>;

/**
 * Root list fields evicted when no mounted screen uses them, after a reconnect or resync, so they
 * are read again when next shown (SYSTEM_DESIGN.md §5.5). Later features add theirs here.
 */
export const LIST_ROOT_FIELDS: readonly string[] = [
  'products',
  'lowStockProducts',
  'categories',
  'customers',
  'vendors',
  'customerLedger',
  'vendorLedger',
  'orders',
];
