import { envSchema, type AppConfig } from './env.schema';

export type { AppConfig } from './env.schema';

/** Injection token for the validated configuration (no code reads process.env directly). */
export const APP_CONFIG = Symbol('APP_CONFIG');

export type EnvSource = Readonly<Record<string, string | undefined>>;

/**
 * Validates the environment and fails fast (DEPLOYMENT.md §4). The error lists field names and
 * reasons only, never the values, so secrets cannot leak into logs.
 */
export function loadConfig(source: EnvSource): AppConfig {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const reasons = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'} ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid configuration: ${reasons}`);
  }
  return result.data;
}
