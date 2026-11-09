import { describe, expect, it } from 'vitest';

import { querySql } from '@pos/testkit';

import { apply } from '../src/commands/apply.js';

import { EMPTY, PLANNED, targetCounts, useFixture } from './support.js';

const t = useFixture();

describe('apply refuses, or rolls back completely', () => {
  it('needs the fingerprint of a dry run', async () => {
    const missing = await apply(t.f.config, t.f.log, undefined);
    const wrong = await apply(t.f.config, t.f.log, '000000000000');

    expect(missing.outcome).toMatch(/^REFUSED: apply needs --confirm/);
    expect(wrong.outcome).toMatch(
      /^REFUSED: the old data is not what the confirmed dry run showed/,
    );
    expect(wrong.fingerprint).toBeNull();
    expect(await targetCounts(t.f.target.url)).toEqual(EMPTY);
  });

  it('refuses when the old data changed after the dry run', async () => {
    await querySql(
      t.f.legacy.url,
      `INSERT INTO vendor_transactions (vendor_id, type, amount, payment_method, created_at)
       VALUES (2, 'payment', 50, 'cash', '2026-11-05 10:00:00+05')`,
    );
    try {
      const report = await apply(t.f.config, t.f.log, t.fingerprint);
      expect(report.outcome).toMatch(
        /^REFUSED: the old data is not what the confirmed dry run showed/,
      );
      expect(await targetCounts(t.f.target.url)).toEqual(EMPTY);
    } finally {
      await querySql(
        t.f.legacy.url,
        "DELETE FROM vendor_transactions WHERE created_at = '2026-11-05 10:00:00+05'",
      );
    }
  });

  it('refuses a new database that already holds data it did not write', async () => {
    await querySql(
      t.f.target.url,
      `INSERT INTO categories (id, name, updated_at) VALUES (gen_random_uuid(), 'Typed in by hand', now())`,
    );
    try {
      const report = await apply(t.f.config, t.f.log, t.fingerprint);
      expect(report.outcome).toMatch(/^REFUSED: the new database is not ready/);
      expect(report.preflight?.problems.join(' ')).toMatch(
        /categories has 1 row\(s\) the migration did not write/,
      );
    } finally {
      await querySql(t.f.target.url, 'DELETE FROM categories');
    }
    expect(await targetCounts(t.f.target.url)).toEqual(EMPTY);
  });

  it('rolls back everything when a write fails half way, and a re-run then completes', async () => {
    await querySql(
      t.f.target.url,
      `CREATE FUNCTION fail_refund() RETURNS trigger LANGUAGE plpgsql AS
         $$ BEGIN RAISE EXCEPTION 'simulated failure while writing refunds'; END $$;
       CREATE TRIGGER fail_refund BEFORE INSERT ON refunds FOR EACH ROW EXECUTE FUNCTION fail_refund();`,
    );
    const failed = await apply(t.f.config, t.f.log, t.fingerprint);

    expect(failed.ok).toBe(false);
    expect(failed.outcome).toMatch(
      /^FAILED: .*simulated failure while writing refunds.*nothing was written/,
    );
    expect(await targetCounts(t.f.target.url)).toEqual(EMPTY);

    await querySql(
      t.f.target.url,
      'DROP TRIGGER fail_refund ON refunds; DROP FUNCTION fail_refund();',
    );
    const recovered = await apply(t.f.config, t.f.log, t.fingerprint);
    expect(recovered.ok).toBe(true);
    expect(await targetCounts(t.f.target.url)).toEqual(PLANNED);
  });
});
