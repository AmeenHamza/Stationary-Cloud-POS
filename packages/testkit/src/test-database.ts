import { randomBytes } from 'node:crypto';

import pg from 'pg';

import { assertLocalUrl } from './env.js';

export interface TestDatabase {
  /** Connection URL of the freshly created database. */
  url: string;
  name: string;
  drop: () => Promise<void>;
}

function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

async function adminQuery(baseUrl: string, sql: string): Promise<void> {
  const client = new pg.Client({ connectionString: withDatabase(baseUrl, 'postgres') });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

const INSUFFICIENT_PRIVILEGE = '42501';
const DROP_ATTEMPTS = 20;

/**
 * Drops a test database. `WITH (FORCE)` ends our own connections, but an autovacuum worker (a
 * superuser backend analysing freshly bulk-loaded tables) cannot be ended by the test role, so the
 * drop waits briefly on the server (`pg_sleep`, no client timers) and retries.
 */
async function dropDatabase(baseUrl: string, name: string): Promise<void> {
  const client = new pg.Client({ connectionString: withDatabase(baseUrl, 'postgres') });
  await client.connect();
  try {
    for (let attempt = 1; ; attempt += 1) {
      try {
        await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
        return;
      } catch (error) {
        const code = (error as { code?: unknown }).code;
        if (code !== INSUFFICIENT_PRIVILEGE || attempt >= DROP_ATTEMPTS) {
          throw error;
        }
        await client.query('SELECT pg_sleep(0.25)');
      }
    }
  } finally {
    await client.end();
  }
}

/**
 * Creates an isolated database (optionally from a template) for one test file
 * (TESTING.md §2). Names are random, so parallel runs never collide.
 */
export async function createTestDatabase(
  baseUrl: string,
  options: { template?: string; prefix?: string } = {},
): Promise<TestDatabase> {
  assertLocalUrl(baseUrl);
  const name = `${options.prefix ?? 't'}_${randomBytes(6).toString('hex')}`;
  const template = options.template === undefined ? '' : ` TEMPLATE "${options.template}"`;
  await adminQuery(baseUrl, `CREATE DATABASE "${name}"${template}`);
  return {
    url: withDatabase(baseUrl, name),
    name,
    drop: () => dropDatabase(baseUrl, name),
  };
}

/** Runs one SQL statement against a database and returns its rows. */
export async function querySql<T extends Record<string, unknown>>(
  url: string,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const result = await client.query<T>(sql, params);
    return result.rows;
  } finally {
    await client.end();
  }
}
