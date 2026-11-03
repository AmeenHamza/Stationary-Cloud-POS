import { Global, Inject, Injectable, Module, type OnApplicationShutdown } from '@nestjs/common';

import { APP_CONFIG, type AppConfig } from '../../config/app-config';

import { RedisStatus } from './redis-status';
import { REDIS_CLIENT, createRedisClient, type RedisRole } from './redis.clients';

import type { Redis } from 'ioredis';

const ROLES: readonly RedisRole[] = ['cache', 'publisher', 'subscriber'];

function clientProvider(role: RedisRole) {
  return {
    provide: REDIS_CLIENT[role],
    inject: [APP_CONFIG, RedisStatus],
    useFactory: (config: AppConfig, status: RedisStatus): Redis => {
      const client = createRedisClient(config.REDIS_URL, role);
      status.watch(role, client);
      return client;
    },
  };
}

@Injectable()
class RedisShutdown implements OnApplicationShutdown {
  constructor(
    private readonly status: RedisStatus,
    @Inject(REDIS_CLIENT.cache) private readonly cache: Redis,
    @Inject(REDIS_CLIENT.publisher) private readonly publisher: Redis,
    @Inject(REDIS_CLIENT.subscriber) private readonly subscriber: Redis,
  ) {}

  onApplicationShutdown(): void {
    this.status.stop();
    for (const client of [this.cache, this.publisher, this.subscriber]) {
      client.disconnect(false);
    }
  }
}

/** Redis is mandatory infrastructure (D-26) but never on the critical path of a sale. */
@Global()
@Module({
  providers: [RedisStatus, ...ROLES.map(clientProvider), RedisShutdown],
  exports: [RedisStatus, ...ROLES.map((role) => REDIS_CLIENT[role])],
})
export class RedisModule {}
