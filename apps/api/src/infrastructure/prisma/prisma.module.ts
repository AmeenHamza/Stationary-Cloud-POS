import { Global, Inject, Injectable, Module, type OnApplicationShutdown } from '@nestjs/common';

import { createDatabaseClient } from '@pos/database';

import { APP_CONFIG, type AppConfig } from '../../config/app-config';

/** The application's single Prisma client (pooled URL in production, ADR-006). */
export const PRISMA_CLIENT = 'PRISMA_CLIENT';
export type AppPrismaClient = ReturnType<typeof createDatabaseClient>;

@Injectable()
class PrismaShutdown implements OnApplicationShutdown {
  constructor(@Inject(PRISMA_CLIENT) private readonly client: AppPrismaClient) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.$disconnect();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: PRISMA_CLIENT,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): AppPrismaClient =>
        createDatabaseClient({
          connectionString: config.DATABASE_URL,
          maxConnections: config.DB_POOL_MAX,
        }),
    },
    PrismaShutdown,
  ],
  exports: [PRISMA_CLIENT],
})
export class PrismaModule {}
