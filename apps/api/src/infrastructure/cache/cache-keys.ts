/**
 * The only place Redis keys are built (INSTRUCTIONS.md §9). Every family is listed with its TTL
 * and invalidation in SYSTEM_DESIGN.md §6.2. Each environment has its own Redis, so keys carry
 * no environment prefix.
 */
export const REDIS_NAMESPACE = 'pos:v1';

/** Reference-data families cached with generation-based invalidation. */
export const CACHE_FAMILIES = ['categories', 'settings'] as const;
export type CacheFamily = (typeof CACHE_FAMILIES)[number];

export const CacheKeys = {
  session: (tokenHashHex: string): string => `${REDIS_NAMESPACE}:sess:${tokenHashHex}`,
  generation: (family: CacheFamily): string => `${REDIS_NAMESPACE}:gen:${family}`,
  reference: (family: CacheFamily, generation: number, variant: string): string =>
    `${REDIS_NAMESPACE}:ref:${family}:g${String(generation)}:${variant}`,
  ai: (feature: string, hash: string): string => `${REDIS_NAMESPACE}:ai:${feature}:${hash}`,
  rateLimit: (bucket: string, key: string): string => `${REDIS_NAMESPACE}:rl:${bucket}:${key}`,
} as const;
