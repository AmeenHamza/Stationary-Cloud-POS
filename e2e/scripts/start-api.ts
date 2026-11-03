import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createWriteStream, existsSync } from 'node:fs';
import path from 'node:path';

import { hash } from '@node-rs/argon2';
import { Redis } from 'ioredis';

import {
  assertLocalUrl,
  createTestDatabase,
  migrateDatabase,
  querySql,
  requireTestEnv,
  startGroqStub,
} from '@pos/testkit';

import { API_LOG_FILE, API_PORT, E2E_USERS, GROQ_STUB_PORT, WEB_URL } from '../fixtures/users.js';

/**
 * Playwright's API server: drops old `e2e_*` databases, creates and migrates a fresh one, seeds the
 * fixture accounts, empties the test Redis and starts the built API against them (production mode),
 * with the Groq stub as its AI provider. The API's log lines go to `API_LOG_FILE` (stderr also to
 * the console) so E2E-14 can check that no secret was logged (SEC-11).
 */
const ROOT = path.join(import.meta.dirname, '..', '..');
const API_ENV_FILE = path.join(ROOT, 'apps', 'api', '.env');
if (existsSync(API_ENV_FILE)) {
  process.loadEnvFile(API_ENV_FILE); // TEST_DATABASE_URL and TEST_REDIS_URL for local runs
}

async function dropOldDatabases(baseUrl: string): Promise<void> {
  const rows = await querySql<{ name: string }>(
    baseUrl,
    "SELECT datname AS name FROM pg_database WHERE datname LIKE 'e2e\\_%'",
  );
  for (const { name } of rows) {
    await querySql(baseUrl, `DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  }
}

async function seedUsers(databaseUrl: string): Promise<void> {
  for (const user of Object.values(E2E_USERS)) {
    await querySql(
      databaseUrl,
      `INSERT INTO users (id, username, full_name, password_hash, role, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4::user_role, now())`,
      [user.username, user.fullName, await hash(user.password), user.role],
    );
  }
}

async function flushRedis(redisUrl: string): Promise<void> {
  const client = new Redis(redisUrl);
  await client.flushdb();
  client.disconnect();
}

async function main(): Promise<void> {
  const baseUrl = requireTestEnv('TEST_DATABASE_URL');
  const redisUrl = requireTestEnv('TEST_REDIS_URL');
  assertLocalUrl(redisUrl);
  await dropOldDatabases(baseUrl);
  const db = await createTestDatabase(baseUrl, { prefix: 'e2e' });
  migrateDatabase(path.join(ROOT, 'packages', 'database'), db.url);
  await seedUsers(db.url);
  await flushRedis(redisUrl);

  const stub = await startGroqStub(GROQ_STUB_PORT);
  const log = createWriteStream(API_LOG_FILE, { flags: 'w' });
  const api = spawn(process.execPath, ['dist/main.js'], {
    cwd: path.join(ROOT, 'apps', 'api'),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(API_PORT),
      LOG_LEVEL: 'info',
      DATABASE_URL: db.url,
      REDIS_URL: redisUrl,
      WEB_ORIGIN: WEB_URL,
      TRUST_PROXY_HOPS: '0',
      SETTINGS_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
      METRICS_TOKEN: randomBytes(24).toString('hex'),
      GROQ_BASE_URL: stub.url,
    },
  });
  api.stdout.pipe(log);
  api.stderr.pipe(log);
  api.stderr.pipe(process.stderr);
  const stop = (): void => {
    api.kill();
    void stub.close();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  api.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

await main();
