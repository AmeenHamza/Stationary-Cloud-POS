import { Controller, Get, Inject, Res } from '@nestjs/common';

import { Public } from '../../common/auth/access-policy';
import { sleep } from '../../common/time/sleep';
import { PRISMA_CLIENT, type AppPrismaClient } from '../../infrastructure/prisma/prisma.module';
import { RedisStatus } from '../../infrastructure/redis/redis-status';

import type { Response } from 'express';

const DATABASE_TIMEOUT_MS = 2_000;

/**
 * Health endpoints (API.md §9). `live` touches neither the database nor Redis, so uptime monitors
 * cost no Neon transfer. `ready` needs PostgreSQL; Redis is reported as degraded but never fails
 * readiness (SYSTEM_DESIGN.md §6.5).
 */
@Controller('health')
@Public()
export class HealthController {
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: AppPrismaClient,
    private readonly redis: RedisStatus,
  ) {}

  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready(@Res() res: Response): Promise<void> {
    const databaseUp = await this.databaseUp();
    const redis =
      this.redis.isReady('cache') && this.redis.isReady('publisher') ? 'up' : 'degraded';
    if (!databaseUp) {
      res.status(503).json({ status: 'unavailable', database: 'down', redis });
      return;
    }
    res.status(200).json({ status: redis === 'up' ? 'ok' : 'degraded', database: 'up', redis });
  }

  private async databaseUp(): Promise<boolean> {
    const probe = this.prisma.$queryRaw`SELECT 1`.then(
      () => true,
      () => false,
    );
    const timeout = sleep(DATABASE_TIMEOUT_MS).then(() => false);
    return Promise.race([probe, timeout]);
  }
}
