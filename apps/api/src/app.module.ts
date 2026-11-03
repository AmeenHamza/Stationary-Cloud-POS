import { Module, type DynamicModule } from '@nestjs/common';

import { CommonModule } from './common/common.module';
import { GraphqlApiModule } from './common/graphql/graphql.module';
import { LoggingModule } from './common/logging/logger.module';
import { ConfigModule } from './config/config.module';
import { CacheModule } from './infrastructure/cache/cache.module';
import { MetricsModule } from './infrastructure/metrics/metrics.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { ClsTransactionalModule } from './infrastructure/prisma/transactional.module';
import { RateLimitModule } from './infrastructure/rate-limit/rate-limit.module';
import { RealtimeInfraModule } from './infrastructure/realtime/realtime-infra.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { UnitOfWorkModule } from './infrastructure/unit-of-work/unit-of-work.module';
import { AiAssistantModule } from './modules/ai-assistant';
import { AuditModule } from './modules/audit';
import { AuthModule } from './modules/auth';
import { CatalogModule } from './modules/catalog';
import { CatalogIoModule } from './modules/catalog-io';
import { HealthModule } from './modules/health/health.module';
import { KhataModule } from './modules/khata';
import { RealtimeModule } from './modules/realtime';
import { ReportingModule } from './modules/reporting';
import { SalesModule } from './modules/sales';
import { ServerInfoModule } from './modules/server-info/server-info.module';
import { SettingsModule } from './modules/settings';
import { StaffModule } from './modules/staff';

import type { EnvSource } from './config/app-config';

/** Root module. The environment is passed in so tests and the schema emitter control it. */
@Module({})
export class AppModule {
  static forRoot(env: EnvSource): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(env),
        LoggingModule,
        CommonModule,
        MetricsModule,
        PrismaModule,
        ClsTransactionalModule,
        RedisModule,
        CacheModule,
        RateLimitModule,
        UnitOfWorkModule,
        RealtimeInfraModule,
        GraphqlApiModule,
        AiAssistantModule,
        AuditModule,
        AuthModule,
        CatalogModule,
        CatalogIoModule,
        HealthModule,
        KhataModule,
        RealtimeModule,
        SalesModule,
        ReportingModule,
        ServerInfoModule,
        SettingsModule,
        StaffModule,
      ],
    };
  }
}
