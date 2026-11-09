import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_BUSINESS_TIMEZONE } from '@pos/contracts';

/** The tool's own folder: `.env` and the default `output/` live here (both git-ignored). */
export const TOOL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export interface MigrationConfig {
  /** The old system's database: only ever read. */
  legacyUrl: string;
  /** The new system's database; the direct (non-pooled) endpoint for `apply`. */
  targetUrl: string;
  /** Rows per read page and per INSERT statement. */
  batchSize: number;
  /** Reports, CSV files and the run log go to a new folder under this one. */
  outDir: string;
  /** How the old app's `timestamp without time zone` values are read (none exist today). */
  naiveZone: string;
  /** Business dates (bill dates, khata dates) are in this zone (Q18). */
  timeZone: string;
}

export class ConfigError extends Error {}

const DEFAULT_BATCH = 500;
const MAX_BATCH = 5_000;
const ZONES = ['UTC', 'Asia/Karachi'];

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim() ?? '';
  if (value === '') {
    throw new ConfigError(
      `${name} is not set. Copy .env.example to .env in ${TOOL_ROOT} and fill it in.`,
    );
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ConfigError(`${name} is not a valid URL.`); // the value itself is never printed
  }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new ConfigError(`${name} must be a postgresql:// URL.`);
  }
  return value;
}

/** A setting's value; blank counts as not set (the copied .env.example leaves some blank). */
function setting(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = env[name]?.trim() ?? '';
  return value === '' ? undefined : value;
}

function batchSizeOf(raw: string | undefined): number {
  const value = Number(raw ?? DEFAULT_BATCH);
  if (!Number.isInteger(value) || value < 1 || value > MAX_BATCH) {
    throw new ConfigError(`The batch size must be a whole number from 1 to ${String(MAX_BATCH)}.`);
  }
  return value;
}

/** Reads the tool's `.env` (never overriding variables already set) and the command-line flags. */
export function loadConfig(
  flags: Readonly<Record<string, string | undefined>>,
  env: NodeJS.ProcessEnv = process.env,
): MigrationConfig {
  const envFile = path.join(TOOL_ROOT, '.env');
  if (env === process.env && existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
  const naiveZone = setting(env, 'LEGACY_NAIVE_TIMESTAMPS') ?? 'UTC';
  if (!ZONES.includes(naiveZone)) {
    throw new ConfigError(`LEGACY_NAIVE_TIMESTAMPS must be one of ${ZONES.join(', ')}.`);
  }
  const legacyUrl = required(env, 'LEGACY_DATABASE_URL');
  const targetUrl = required(env, 'TARGET_DATABASE_URL');
  if (
    new URL(legacyUrl).host === new URL(targetUrl).host &&
    new URL(legacyUrl).pathname === new URL(targetUrl).pathname
  ) {
    throw new ConfigError(
      'LEGACY_DATABASE_URL and TARGET_DATABASE_URL point at the same database.',
    );
  }
  return {
    legacyUrl,
    targetUrl,
    batchSize: batchSizeOf(flags['batch-size'] ?? setting(env, 'MIGRATION_BATCH_SIZE')),
    outDir: path.resolve(
      flags['out'] ?? setting(env, 'MIGRATION_OUTPUT_DIR') ?? path.join(TOOL_ROOT, 'output'),
    ),
    naiveZone,
    timeZone: DEFAULT_BUSINESS_TIMEZONE,
  };
}

/** Where a URL points, without user or password: safe to print and log. */
export function describeUrl(url: string): string {
  const parsed = new URL(url);
  return `${parsed.hostname}${parsed.port === '' ? '' : `:${parsed.port}`}${parsed.pathname}`;
}
