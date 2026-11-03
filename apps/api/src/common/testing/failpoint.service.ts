import { Inject, Injectable } from '@nestjs/common';

import { APP_CONFIG, type AppConfig } from '../../config/app-config';

/**
 * Test-only fault injection (TESTING.md §2): `arm('after-stock-update')` makes the next `hit` with
 * that name throw, to prove transactions roll back. Inert unless NODE_ENV=test.
 */
@Injectable()
export class FailpointService {
  private readonly armed = new Set<string>();

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  arm(name: string): void {
    if (this.config.NODE_ENV !== 'test') {
      throw new Error('Failpoints can only be armed when NODE_ENV=test.');
    }
    this.armed.add(name);
  }

  hit(name: string): void {
    if (this.armed.delete(name)) {
      throw new Error(`Failpoint "${name}" triggered`);
    }
  }
}
