import { Inject, Injectable } from '@nestjs/common';

import { businessDateOf, type BusinessDate } from '@pos/domain';

import { APP_CONFIG, type AppConfig } from '../../config/app-config';

/**
 * The only source of "now" for application code (CODING_STANDARDS.md §5), so tests can control
 * time. Bill dates use the database clock instead (SYSTEM_DESIGN.md §3.3).
 */
@Injectable()
export class ClockService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  now(): Date {
    return new Date();
  }

  businessDate(instant: Date = this.now()): BusinessDate {
    return businessDateOf(instant, this.config.BUSINESS_TIMEZONE);
  }
}
