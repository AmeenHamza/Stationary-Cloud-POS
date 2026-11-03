import { REDIS_NAMESPACE } from '../cache/cache-keys';

/** The one BullMQ queue (ADR-020, SYSTEM_DESIGN.md §6.8). */
export const PRODUCT_IMPORT_QUEUE = 'product-import';

/** BullMQ keys live under the API's Redis namespace (SYSTEM_DESIGN.md §6.2). */
export const QUEUE_PREFIX = `${REDIS_NAMESPACE}:bull`;
