import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './generated/prisma/client.js';

export interface DatabaseClientOptions {
  /** Pooled URL in production (DECISIONS.md ADR-006); local URL in development and tests. */
  connectionString: string;
  /** Maximum pooled connections held by this process. */
  maxConnections?: number;
}

/**
 * The single place a Prisma client is constructed (Prisma 7 requires a driver adapter).
 * Applications must not instantiate `PrismaClient` directly.
 */
export function createDatabaseClient(options: DatabaseClientOptions): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: options.connectionString,
    max: options.maxConnections ?? 10,
  });
  return new PrismaClient({ adapter });
}
