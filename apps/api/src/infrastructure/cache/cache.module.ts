import { Global, Module } from '@nestjs/common';

import { CacheInvalidation } from './cache-invalidation';
import { CacheService } from './cache.service';

@Global()
@Module({
  providers: [CacheService, CacheInvalidation],
  exports: [CacheService, CacheInvalidation],
})
export class CacheModule {}
