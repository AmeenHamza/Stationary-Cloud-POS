import { timingSafeEqual } from 'node:crypto';

import { Controller, Get, Headers, Inject, Res } from '@nestjs/common';

import { Public } from '../../common/auth/access-policy';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';

import { MetricsService } from './metrics.service';

import type { Response } from 'express';

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** `GET /metrics` with `Authorization: Bearer $METRICS_TOKEN` (API.md §9); 404 when unconfigured. */
@Controller('metrics')
@Public() // no session: guarded by the bearer token below
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get()
  async scrape(@Headers('authorization') authorization: string | undefined, @Res() res: Response) {
    const token = this.config.METRICS_TOKEN;
    if (token === undefined) {
      res.status(404).end();
      return;
    }
    if (authorization === undefined || !sameSecret(authorization, `Bearer ${token}`)) {
      res.status(401).end();
      return;
    }
    res.type(this.metrics.registry.contentType).send(await this.metrics.registry.metrics());
  }
}
