import { describe, expect, it } from 'vitest';

import { AppError } from '../errors/app-error';

import { decodeCursor, encodeCursor } from './cursor.codec';
import { keysetOrderBy, keysetWhere, toConnection, type KeysetSort } from './keyset';

const BY_NAME: KeysetSort = { name: 'NAME_ASC', field: 'nameKey', direction: 'asc' };
const NEWEST: KeysetSort = { name: 'CREATED_DESC', field: 'createdAt', direction: 'desc' };
const ID = '0190f3a4-0000-7000-8000-000000000001';

function codeOf(work: () => unknown): string | undefined {
  try {
    work();
    return undefined;
  } catch (error) {
    return error instanceof AppError ? error.code : 'NOT_APP_ERROR';
  }
}

const raw = (value: unknown): string =>
  Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');

describe('cursor codec', () => {
  it('round-trips string and number keys', () => {
    expect(decodeCursor(encodeCursor('NAME_ASC', 'pencil', ID), 'NAME_ASC')).toEqual({
      key: 'pencil',
      id: ID,
    });
    expect(decodeCursor(encodeCursor('STOCK_ASC', 12, ID), 'STOCK_ASC')).toEqual({
      key: 12,
      id: ID,
    });
  });

  it('is opaque url-safe text', () => {
    expect(encodeCursor('NAME_ASC', 'a/b+c', ID)).toMatch(/^[\w-]+$/);
  });

  it('rejects a cursor from another sort order', () => {
    expect(codeOf(() => decodeCursor(encodeCursor('NAME_ASC', 'x', ID), 'CREATED_DESC'))).toBe(
      'BAD_CURSOR',
    );
  });

  it.each([
    ['garbage', 'not-a-cursor!!'],
    ['empty', ''],
    ['wrong version', raw({ v: 2, s: 'NAME_ASC', k: ['x', ID] })],
    ['missing id', raw({ v: 1, s: 'NAME_ASC', k: ['x'] })],
    ['object key', raw({ v: 1, s: 'NAME_ASC', k: [{}, ID] })],
    ['null payload', raw(null)],
  ])('rejects a malformed cursor (%s)', (_label, cursor) => {
    expect(codeOf(() => decodeCursor(cursor, 'NAME_ASC'))).toBe('BAD_CURSOR');
  });
});

describe('keyset helpers', () => {
  it('has no where clause for the first page', () => {
    expect(keysetWhere(BY_NAME, undefined)).toBeUndefined();
    expect(keysetWhere(BY_NAME, null)).toBeUndefined();
  });

  it('builds (field, id) > (key, id) for ascending sorts', () => {
    expect(keysetWhere(BY_NAME, encodeCursor('NAME_ASC', 'pen', ID))).toEqual({
      OR: [{ nameKey: { gt: 'pen' } }, { nameKey: 'pen', id: { gt: ID } }],
    });
  });

  it('uses lt for descending sorts and orders by the field then id', () => {
    const when = '2026-10-29T10:00:00.000Z';
    expect(keysetWhere(NEWEST, encodeCursor('CREATED_DESC', when, ID))).toEqual({
      OR: [{ createdAt: { lt: when } }, { createdAt: when, id: { lt: ID } }],
    });
    expect(keysetOrderBy(NEWEST)).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });
});

describe('toConnection', () => {
  const rows = [
    { id: 'a', nameKey: 'apple' },
    { id: 'b', nameKey: 'banana' },
    { id: 'c', nameKey: 'cherry' },
  ];

  it('drops the probe row and reports a next page', () => {
    const page = toConnection(rows, 2, BY_NAME, (row) => row.nameKey);
    expect(page.nodes.map((row) => row.id)).toEqual(['a', 'b']);
    expect(page.pageInfo.hasNextPage).toBe(true);
    expect(page.pageInfo.endCursor).not.toBeNull();
    expect(decodeCursor(page.pageInfo.endCursor ?? '', 'NAME_ASC')).toEqual({
      key: 'banana',
      id: 'b',
    });
  });

  it('reports the last page and an empty page', () => {
    expect(toConnection(rows, 3, BY_NAME, (row) => row.nameKey).pageInfo.hasNextPage).toBe(false);
    const empty = toConnection([], 50, BY_NAME, () => '');
    expect(empty.nodes).toEqual([]);
    expect(empty.pageInfo).toMatchObject({ hasNextPage: false, endCursor: null });
  });

  it('carries the lazy total-count loader only when given', async () => {
    expect('loadTotalCount' in toConnection(rows, 2, BY_NAME, (row) => row.nameKey)).toBe(false);
    const counted = toConnection(
      rows,
      2,
      BY_NAME,
      (row) => row.nameKey,
      () => Promise.resolve(3),
    );
    await expect(counted.loadTotalCount?.()).resolves.toBe(3);
  });
});
