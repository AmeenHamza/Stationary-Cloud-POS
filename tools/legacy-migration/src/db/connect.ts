import { setTimeout as sleep } from 'node:timers/promises';

import pg from 'pg';

import type { RunLog } from '../log.js';

/** Network-level failures worth another attempt; anything else (bad password, SQL error) is not. */
const TRANSIENT_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'EAI_AGAIN',
  '57P01', // admin shutdown (e.g. a Neon compute restarting)
  '57P03', // cannot connect now (starting up)
  '08000',
  '08001',
  '08003',
  '08004',
  '08006',
]);

export function isTransient(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && TRANSIENT_CODES.has(code);
}

const ATTEMPTS = 3;

/** Runs `work`, retrying transient failures with a short backoff (1 s, then 2 s). */
export async function withRetry<T>(what: string, log: RunLog, work: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      if (!isTransient(error) || attempt >= ATTEMPTS) {
        throw error;
      }
      log.warn(`${what} failed with a network error; trying again`, { attempt });
      await sleep(1_000 * attempt);
    }
  }
}

async function connect(url: string, options?: string): Promise<pg.Client> {
  const client = new pg.Client({
    connectionString: url,
    application_name: 'pos-legacy-migration',
    ...(options === undefined ? {} : { options }),
  });
  try {
    await client.connect();
    return client;
  } catch (error) {
    await client.end().catch(() => undefined);
    throw error;
  }
}

/**
 * Opens the old database read-only (the session refuses writes) inside one REPEATABLE READ snapshot,
 * so every table is read as of the same moment while the old app may still be billing. The caller
 * ends it with `closeSnapshot`.
 */
export async function openLegacySnapshot(url: string, log: RunLog): Promise<pg.Client> {
  const client = await withRetry('Connecting to the old database', log, () =>
    connect(url, '-c default_transaction_read_only=on'),
  );
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  return client;
}

export async function closeSnapshot(client: pg.Client): Promise<void> {
  await client.query('COMMIT').catch(() => undefined);
  await client.end();
}

/** Opens the new database; `readOnly` for the dry run and `verify`. */
export function openTarget(url: string, log: RunLog, readOnly: boolean): Promise<pg.Client> {
  return withRetry('Connecting to the new database', log, () =>
    connect(url, readOnly ? '-c default_transaction_read_only=on' : undefined),
  );
}
