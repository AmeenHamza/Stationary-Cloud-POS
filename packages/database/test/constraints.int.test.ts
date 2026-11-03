import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestDatabase, querySql, requireTestEnv, type TestDatabase } from '@pos/testkit';

import { runPrisma } from './prisma-cli.js';

let db: TestDatabase;
const USER_ID = '0192f0c1-0000-7000-8000-000000000001';

beforeAll(async () => {
  db = await createTestDatabase(requireTestEnv('TEST_DATABASE_URL'), { prefix: 'ck' });
  const result = runPrisma(['migrate', 'deploy'], db.url);
  if (result.status !== 0) {
    throw new Error(result.output);
  }
  await querySql(
    db.url,
    `INSERT INTO users (id, username, full_name, password_hash, role, updated_at)
     VALUES ($1, 'admin', 'Admin', 'x', 'ADMIN', now())`,
    [USER_ID],
  );
});

afterAll(async () => {
  await db.drop();
});

const rejects = (sql: string, params: unknown[] = []): Promise<unknown> =>
  expect(querySql(db.url, sql, params)).rejects.toThrow(/violates check constraint|duplicate key/);

describe('database constraints (DATABASE.md §4.1–4.3, §4.13)', () => {
  it('rejects usernames outside [a-z0-9._-]{3,40} and case-insensitive duplicates', async () => {
    const insert = `INSERT INTO users (id, username, full_name, password_hash, role, updated_at)
                    VALUES (gen_random_uuid(), $1, 'X', 'x', 'CASHIER', now())`;
    await rejects(insert, ['ab']);
    await rejects(insert, ['Has Space']);
    await rejects(insert, ['ADMIN']);
  });

  it('keeps shop_settings to a single row with a GST rate in 0–100', async () => {
    await rejects(`INSERT INTO shop_settings (id, shop_name, updated_at) VALUES (2, 'B', now())`);
    await rejects('UPDATE shop_settings SET default_bill_gst_rate = 100.01');
  });

  it('sets the Groq key ciphertext and its last 4 characters together (F-30)', async () => {
    await rejects(`UPDATE shop_settings SET groq_api_key_ciphertext = '\\x0102'`);
    await rejects(`UPDATE shop_settings SET groq_api_key_last4 = 'abcd'`);
    await rejects(
      `UPDATE shop_settings SET groq_api_key_ciphertext = '\\x0102', groq_api_key_last4 = 'abc'`,
    );
    await querySql(
      db.url,
      `UPDATE shop_settings SET groq_api_key_ciphertext = '\\x0102', groq_api_key_last4 = 'abcd'`,
    );
    await querySql(
      db.url,
      'UPDATE shop_settings SET groq_api_key_ciphertext = NULL, groq_api_key_last4 = NULL',
    );
  });

  it('requires revoked_at and revoke_reason together', async () => {
    await rejects(
      `INSERT INTO sessions (id, user_id, token_hash, idle_expires_at, absolute_expires_at, revoked_at)
       VALUES (gen_random_uuid(), $1, '\\x01', now(), now() + interval '1 day', now())`,
      [USER_ID],
    );
  });

  it('rejects idle expiry after absolute expiry', async () => {
    await rejects(
      `INSERT INTO sessions (id, user_id, token_hash, idle_expires_at, absolute_expires_at)
       VALUES (gen_random_uuid(), $1, '\\x02', now() + interval '2 days', now())`,
      [USER_ID],
    );
  });

  it('accepts only known outbox audiences', async () => {
    const insert = `INSERT INTO outbox_events (type, audience, schema_version, payload) VALUES ('x', $1, 1, '{}')`;
    await rejects(insert, ['everyone']);
    await expect(querySql(db.url, insert, ['staff'])).resolves.toEqual([]);
    await expect(querySql(db.url, insert, [`user:${USER_ID}`])).resolves.toEqual([]);
  });
});
