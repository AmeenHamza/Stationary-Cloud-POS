import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { querySql } from '@pos/testkit';

import { dryRun } from '../src/commands/dry-run.js';
import { closeSnapshot, openLegacySnapshot } from '../src/db/connect.js';

import { EMPTY, PLANNED, targetCounts, useFixture } from './support.js';

const t = useFixture();

const kinds = (issues: readonly { kind: string; blocking: boolean }[]) =>
  issues.map((issue) => `${issue.kind}${issue.blocking ? '!' : ''}`).sort();

describe('dry run (MIG-01)', () => {
  it('reports the planned rows, every finding and a fingerprint, and writes nothing', async () => {
    const report = await dryRun(t.f.config, t.f.log);

    expect(report.ok).toBe(true);
    expect(report.planned).toEqual(PLANNED);
    expect(report.read).toMatchObject({ orders: 6, orderItems: 9, customerTransactions: 7 });
    expect(kinds(report.issues)).toEqual([
      'barcode-duplicate',
      'barcode-too-long',
      'category-merged',
      'payment-method-defaulted',
      'zero-amount',
    ]);
    expect(report.preflight?.problems).toEqual([]);
    expect(report.fingerprint).toMatch(/^[0-9a-f]{12}$/);
    expect(report.outcome).toContain(`--confirm ${report.fingerprint ?? ''}`);
    expect(report.oldGstRate).toBe('18.00');
    expect(await targetCounts(t.f.target.url)).toEqual(EMPTY);

    const runs = readdirSync(t.f.config.outDir).filter((name) => name.endsWith('-dry-run'));
    const dir = path.join(t.f.config.outDir, runs.at(-1) ?? '');
    for (const file of ['report.md', 'issues.csv', 'id-map.csv', 'run.jsonl']) {
      expect(existsSync(path.join(dir, file)), file).toBe(true);
    }
  });

  it('gives the same fingerprint for the same data, and a new one when the old data changes', async () => {
    const first = (await dryRun(t.f.config, t.f.log)).fingerprint;
    expect((await dryRun(t.f.config, t.f.log)).fingerprint).toBe(first);

    await querySql(t.f.legacy.url, 'UPDATE products SET stock = stock + 1 WHERE id = 1');
    const changed = (await dryRun(t.f.config, t.f.log)).fingerprint;
    await querySql(t.f.legacy.url, 'UPDATE products SET stock = stock - 1 WHERE id = 1');

    expect(changed).not.toBe(first);
    expect((await dryRun(t.f.config, t.f.log)).fingerprint).toBe(first);
  });

  it('opens the old database in a session that refuses every write', async () => {
    const client = await openLegacySnapshot(t.f.config.legacyUrl, t.f.log);
    try {
      await expect(client.query("UPDATE products SET name = 'x' WHERE id = 1")).rejects.toThrow(
        /read-only transaction/,
      );
    } finally {
      await closeSnapshot(client);
    }
    const [row] = await querySql<{ name: string }>(
      t.f.legacy.url,
      'SELECT name FROM products WHERE id = 1',
    );
    expect(row?.name).toBe('Blue Pen');
  });

  it('stops before reading when the old schema differs from the map', async () => {
    await querySql(t.f.legacy.url, 'ALTER TABLE orders RENAME COLUMN net_amount TO final_amount');
    try {
      const report = await dryRun(t.f.config, t.f.log);
      expect(report.ok).toBe(false);
      expect(report.read).toBeNull();
      expect(report.schemaProblems.join(' ')).toMatch(
        /orders: missing net_amount\. Columns that exist: .*final_amount/,
      );
    } finally {
      await querySql(t.f.legacy.url, 'ALTER TABLE orders RENAME COLUMN final_amount TO net_amount');
    }
  });
});
