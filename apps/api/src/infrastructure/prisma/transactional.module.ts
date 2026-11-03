import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { ClsModule } from 'nestjs-cls';

import { PRISMA_CLIENT, PrismaModule, type AppPrismaClient } from './prisma.module';

/** Transaction adapter type used by `TransactionHost<PrismaTx>` (ADR-029). */
export type PrismaTx = TransactionalAdapterPrisma<AppPrismaClient>;

type PluginAdapter = ConstructorParameters<typeof ClsPluginTransactional>[0]['adapter'];

const adapter = new TransactionalAdapterPrisma<AppPrismaClient>({
  prismaInjectionToken: PRISMA_CLIENT,
  defaultTxOptions: { timeout: 10_000, maxWait: 5_000 },
});

/**
 * Continuation-local storage for every HTTP request, plus transaction propagation: repositories
 * read the active transaction through `TransactionalClient` instead of passing `tx` around.
 * Timeouts follow DATABASE.md §6 (the UnitOfWork also sets lock/statement timeouts).
 */
export const ClsTransactionalModule = ClsModule.forRoot({
  global: true,
  middleware: { mount: true },
  plugins: [
    new ClsPluginTransactional({
      imports: [PrismaModule],
      // The adapter's declared `defaultTxOptions` type is not assignable under
      // exactOptionalPropertyTypes (a library typing detail); the value itself matches.
      adapter: adapter as PluginAdapter,
    }),
  ],
});
