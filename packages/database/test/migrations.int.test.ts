import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestDatabase, querySql, requireTestEnv, type TestDatabase } from '@pos/testkit';

import { runPrisma } from './prisma-cli.js';

let db: TestDatabase;

beforeAll(async () => {
  db = await createTestDatabase(requireTestEnv('TEST_DATABASE_URL'), { prefix: 'mig' });
});

afterAll(async () => {
  await db.drop();
});

describe('migrations (IMPLEMENTATION_PLAN.md Phase 2)', () => {
  it('apply cleanly to an empty database', () => {
    const result = runPrisma(['migrate', 'deploy'], db.url);
    expect(result.output).toContain('All migrations have been successfully applied');
    expect(result.status).toBe(0);
  });

  it('leave no drift between the migrated database and the Prisma schema', () => {
    const result = runPrisma(
      [
        'migrate',
        'diff',
        '--from-config-datasource',
        '--to-schema',
        'prisma/schema',
        '--exit-code',
      ],
      db.url,
    );
    expect(result.status, result.output).toBe(0);
  });

  it('install the extensions and the default settings row', async () => {
    const extensions = await querySql<{ extname: string }>(
      db.url,
      "SELECT extname FROM pg_extension WHERE extname IN ('citext', 'pg_trgm') ORDER BY extname",
    );
    expect(extensions.map((e) => e.extname)).toEqual(['citext', 'pg_trgm']);
    const settings = await querySql<{ id: number; default_bill_gst_rate: string }>(
      db.url,
      'SELECT id, default_bill_gst_rate FROM shop_settings',
    );
    expect(settings).toEqual([{ id: 1, default_bill_gst_rate: '18.00' }]);
  });

  it('create the partial unpublished-outbox index', async () => {
    const rows = await querySql<{ indexdef: string }>(
      db.url,
      "SELECT indexdef FROM pg_indexes WHERE indexname = 'outbox_unpublished_idx'",
    );
    expect(rows[0]?.indexdef).toContain('WHERE (published_at IS NULL)');
  });
});
