import { describe, expect, it } from 'vitest';

import { insertRows } from './insert.js';

import type pg from 'pg';

/** Records each statement and reports every row as inserted, returning its first value as `id`. */
function fakeClient() {
  const calls: { sql: string; values: unknown[] }[] = [];
  const client = {
    query: (sql: string, values: unknown[]) => {
      calls.push({ sql, values });
      const rows = sql.includes('RETURNING')
        ? values.filter((_, i) => i % 2 === 0).map((id) => ({ id }))
        : [];
      return Promise.resolve({ rowCount: values.length / 2, rows });
    },
  };
  return { calls, client: client as unknown as pg.ClientBase };
}

const spec = { table: 'things', columns: ['id', 'name'], conflict: '(id)' };

describe('insertRows', () => {
  it('splits rows into batches with numbered bind parameters, never inline values', async () => {
    const { calls, client } = fakeClient();
    const rows = [
      ['a', 'one'],
      ['b', "it's"],
      ['c', 'three'],
    ];
    const result = await insertRows(client, spec, rows, 2);

    expect(result).toEqual({ planned: 3, inserted: 3, rows: [] });
    expect(calls.map((call) => call.sql)).toEqual([
      'INSERT INTO "things" ("id", "name") VALUES ($1, $2), ($3, $4) ON CONFLICT (id) DO NOTHING',
      'INSERT INTO "things" ("id", "name") VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
    ]);
    expect(calls[0]?.values).toEqual(['a', 'one', 'b', "it's"]);
  });

  it('returns the inserted rows when asked', async () => {
    const { client } = fakeClient();
    const result = await insertRows(client, { ...spec, returning: 'id' }, [['a', 'x']], 10);
    expect(result.rows).toEqual([{ id: 'a' }]);
  });

  it('keeps each statement under the parameter limit', async () => {
    const { calls, client } = fakeClient();
    const wide = {
      table: 't',
      columns: Array.from({ length: 30_000 }, (_, i) => `c${String(i)}`),
      conflict: '',
    };
    const row = Array.from({ length: 30_000 }, () => null);
    await insertRows(client, wide, [row, row, row], 500);
    expect(calls.map((call) => call.values.length)).toEqual([60_000, 30_000]);
  });

  it('refuses a row with the wrong number of values', async () => {
    const { client } = fakeClient();
    await expect(insertRows(client, spec, [['only one']], 10)).rejects.toThrow(
      /1 values for 2 columns/,
    );
  });

  it('does nothing for no rows', async () => {
    const { calls, client } = fakeClient();
    expect(await insertRows(client, spec, [], 10)).toEqual({ planned: 0, inserted: 0, rows: [] });
    expect(calls).toEqual([]);
  });
});
