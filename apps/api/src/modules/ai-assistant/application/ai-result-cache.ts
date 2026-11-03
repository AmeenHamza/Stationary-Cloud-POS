import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { CacheKeys } from '../../../infrastructure/cache/cache-keys';
import { CacheService } from '../../../infrastructure/cache/cache.service';

import type { AiFeature } from '@pos/contracts';

/** What is cached: the generated text and when it was generated. Never inputs or data. */
export interface CachedAiResult {
  text: string;
  generatedAt: string;
}

const TTL_SECONDS = 900;

function isCachedAiResult(value: unknown): value is CachedAiResult {
  const candidate = value as Partial<CachedAiResult> | null;
  return typeof candidate?.text === 'string' && typeof candidate.generatedAt === 'string';
}

/**
 * AI results for 15 minutes (ADR-026), keyed by a hash of everything that shapes the answer:
 * feature, inputs, language, business date and model (SYSTEM_DESIGN.md §8 step 2). A Redis failure
 * only means "not cached".
 */
@Injectable()
export class AiResultCache {
  constructor(private readonly cache: CacheService) {}

  key(feature: AiFeature, parts: Readonly<Record<string, unknown>>): string {
    const hash = createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 32);
    return CacheKeys.ai(feature.toLowerCase(), hash);
  }

  async get(key: string): Promise<CachedAiResult | undefined> {
    const raw = await this.cache.getRaw(key);
    if (raw === null) {
      return undefined;
    }
    try {
      const value: unknown = JSON.parse(raw);
      return isCachedAiResult(value) ? value : undefined;
    } catch {
      return undefined;
    }
  }

  async set(key: string, value: CachedAiResult): Promise<void> {
    await this.cache.setRaw(key, JSON.stringify(value), TTL_SECONDS, false);
  }
}
