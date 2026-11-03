import { performance } from 'node:perf_hooks';

import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import { ClockService } from '../../../common/time/clock.service';
import { GroqClient } from '../../../infrastructure/ai/groq.client';
import { SingleFlight } from '../../../infrastructure/cache/single-flight';
import { RateLimiterService } from '../../../infrastructure/rate-limit/rate-limiter.service';
import { AuditService } from '../../audit';
import { AiKeyService } from '../../settings';

import { AiResultCache } from './ai-result-cache';

import type { Principal } from '../../../common/auth/principal';
import type { AiFeature, AiLanguage } from '@pos/contracts';

/** What one generation produced, for the result and the audit row. */
export interface Generated {
  text: string;
  promptTokens: number;
  completionTokens: number;
  toolRounds: number;
}

export interface AiJob {
  feature: AiFeature;
  language: AiLanguage;
  /** Everything else that shapes the answer (no personal data); hashed into the cache key. */
  inputs: Readonly<Record<string, unknown>>;
  generate: (context: { apiKey: string; today: string }) => Promise<Generated>;
}

/** The model's final text; an empty answer counts as the provider failing (`AI_UNAVAILABLE`). */
export function answerText(content: string | null | undefined): string {
  const text = content?.trim() ?? '';
  if (text === '') {
    throw new AppError('AI_UNAVAILABLE', 'The AI service returned an empty answer. Try again.');
  }
  return text;
}

export interface AiResultValue {
  text: string;
  language: AiLanguage;
  /** A Date: the DateTime scalar serialises only Dates (strings become null). */
  generatedAt: Date;
  cached: boolean;
}

/**
 * The shared path of every AI request (SYSTEM_DESIGN.md §8): rate limit `ai` (30 per hour, fails
 * closed), the decrypted key, the 15-minute result cache with in-process single-flight, then the
 * audit row `ai.requested` (feature, tokens, latency; never prompts, answers or the key).
 */
@Injectable()
export class AiRequestService {
  private readonly flights = new SingleFlight();

  constructor(
    private readonly limiter: RateLimiterService,
    private readonly keys: AiKeyService,
    private readonly cache: AiResultCache,
    private readonly groq: GroqClient,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
  ) {}

  async run(viewer: Principal, job: AiJob): Promise<AiResultValue> {
    await this.limiter.consume('ai', viewer.userId);
    const apiKey = await this.keys.apiKey();
    const today = this.clock.businessDate();
    const started = performance.now();
    const key = this.cache.key(job.feature, {
      ...job.inputs,
      language: job.language,
      today,
      model: this.groq.model,
    });
    const hit = await this.cache.get(key);
    const result =
      hit === undefined
        ? await this.flights.run(key, () => this.generate(key, job, { apiKey, today }))
        : { ...hit, promptTokens: 0, completionTokens: 0, toolRounds: 0 };
    await this.audit.record('ai.requested', viewer.userId, {
      entityType: 'ai',
      entityId: job.feature,
      metadata: {
        feature: job.feature,
        language: job.language,
        cached: hit !== undefined,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        toolRounds: result.toolRounds,
        latencyMs: Math.round(performance.now() - started),
      },
    });
    return {
      text: result.text,
      generatedAt: new Date(result.generatedAt),
      language: job.language,
      cached: hit !== undefined,
    };
  }

  private async generate(key: string, job: AiJob, context: { apiKey: string; today: string }) {
    const generated = await job.generate(context);
    const stored = { text: generated.text, generatedAt: this.clock.now().toISOString() };
    await this.cache.set(key, stored);
    return { ...generated, ...stored };
  }
}
