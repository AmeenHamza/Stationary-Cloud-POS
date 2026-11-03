import { Injectable } from '@nestjs/common';

import { AfterCommit } from '../unit-of-work/after-commit';

import { CacheService } from './cache.service';

import type { CacheFamily } from './cache-keys';

/**
 * Invalidate after commit, never before (SYSTEM_DESIGN.md §6.3): a use case calls `after(family)`
 * inside its transaction; the generation bump runs once the commit succeeded, deduplicated.
 */
@Injectable()
export class CacheInvalidation {
  constructor(
    private readonly afterCommit: AfterCommit,
    private readonly cache: CacheService,
  ) {}

  after(family: CacheFamily): void {
    this.afterCommit.collect('cache-invalidate', family, (families: CacheFamily[]) =>
      this.cache.invalidate([...new Set(families)]),
    );
  }
}
