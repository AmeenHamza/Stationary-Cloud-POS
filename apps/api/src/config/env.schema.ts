import { z } from 'zod';

import { DEFAULT_BUSINESS_TIMEZONE } from '@pos/contracts';

/** Every environment variable the API reads (DEPLOYMENT.md §4.1). */

function hasProtocol(protocols: readonly string[]) {
  return (value: string): boolean => {
    try {
      return protocols.includes(new URL(value).protocol);
    } catch {
      return false;
    }
  };
}

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
    APP_VERSION: z.string().min(1).default('dev'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4001),
    DATABASE_URL: z.string().refine(hasProtocol(['postgres:', 'postgresql:']), {
      error: 'must be a postgresql:// URL',
    }),
    DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
    REDIS_URL: z
      .string()
      .refine(hasProtocol(['redis:', 'rediss:']), { error: 'must be a redis:// URL' }),
    WEB_ORIGIN: z.string().refine(hasProtocol(['http:', 'https:']), { error: 'must be a URL' }),
    BUSINESS_TIMEZONE: z
      .string()
      .default(DEFAULT_BUSINESS_TIMEZONE)
      .refine(isTimeZone, { error: 'must be an IANA time zone' }),
    SESSION_IDLE_HOURS: z.coerce.number().int().min(1).max(72).default(12),
    SESSION_ABSOLUTE_DAYS: z.coerce.number().int().min(1).max(30).default(7),
    SETTINGS_ENCRYPTION_KEY: z
      .string()
      .refine((value) => Buffer.from(value, 'base64').length === 32, {
        error: 'must be base64 of exactly 32 bytes',
      }),
    SIGNUP_SECRET: z.string().max(1024).optional(),
    GROQ_MODEL: z.string().min(1).optional(),
    GROQ_BASE_URL: z
      .string()
      .refine(hasProtocol(['http:', 'https:']))
      .optional(),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
    WORKER_ENABLED: booleanString.default(true),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    SENTRY_DSN: z
      .string()
      .refine(hasProtocol(['https:']))
      .optional(),
    METRICS_TOKEN: z.string().min(32, { error: 'must be at least 32 characters' }).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.METRICS_TOKEN === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['METRICS_TOKEN'],
        message: 'is required in production',
      });
    }
  });

export type AppConfig = z.output<typeof envSchema>;
