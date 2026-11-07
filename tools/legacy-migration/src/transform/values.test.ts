import { describe, expect, it } from 'vitest';

import { Decimal } from '@pos/domain';

import { Issues } from './issues.js';
import { capped, decimal, flag, instant, integer, legacyUuid, money, text } from './values.js';

describe('text', () => {
  it('trims, and reads empty text as null', () => {
    expect(text('  pen  ')).toBe('pen');
    expect(text('   ')).toBeNull();
    expect(text(null)).toBeNull();
  });
});

describe('capped', () => {
  it('keeps text that fits without reporting it', () => {
    const issues = new Issues();
    expect(capped(' pen ', 3, issues, 'products#1', 'name')).toBe('pen');
    expect(issues.list).toEqual([]);
  });

  it('cuts longer text and reports it without blocking', () => {
    const issues = new Issues();
    expect(capped('pencil', 3, issues, 'products#1', 'name')).toBe('pen');
    expect(issues.list).toEqual([
      expect.objectContaining({ kind: 'text-truncated', blocking: false, ref: 'products#1' }),
    ]);
  });
});

describe('decimal', () => {
  it('reads numbers at any precision', () => {
    expect(decimal('12.50')?.toString()).toBe('12.5');
    expect(decimal('0.1000000000000000055')?.toString()).toBe('0.1000000000000000055');
  });

  it('reads anything else as null', () => {
    expect(decimal('abc')).toBeNull();
    expect(decimal('Infinity')).toBeNull();
    expect(decimal(null)).toBeNull();
  });
});

describe('money', () => {
  it('rounds half up to the paisa', () => {
    const issues = new Issues();
    expect(money('12.345', issues, 'orders#1', 'total').toFixed(2)).toBe('12.35');
    expect(money('12.344', issues, 'orders#1', 'total').toFixed(2)).toBe('12.34');
    expect(issues.list).toEqual([]);
  });

  it('reads an empty value as the fallback without reporting it', () => {
    const issues = new Issues();
    expect(money(null, issues, 'orders#1', 'total', new Decimal(7)).toFixed(2)).toBe('7.00');
    expect(issues.list).toEqual([]);
  });

  it('blocks the record when the value is not a number', () => {
    const issues = new Issues();
    expect(money('abc', issues, 'orders#1', 'total').toFixed(2)).toBe('0.00');
    expect(issues.blocking).toBe(1);
    expect(issues.list[0]).toMatchObject({ kind: 'invalid-value', ref: 'orders#1' });
  });
});

describe('integer', () => {
  it('reads whole numbers only', () => {
    expect(integer('7')).toBe(7);
    expect(integer('7.5')).toBeNull();
    expect(integer('abc')).toBeNull();
    expect(integer(null)).toBeNull();
  });
});

describe('flag', () => {
  it('reads the old true values, anything else as false, and empty as null', () => {
    for (const value of ['true', 'T', '1', 'YES', 'y']) {
      expect(flag(value)).toBe(true);
    }
    expect(flag('no')).toBe(false);
    expect(flag('  ')).toBeNull();
    expect(flag(null)).toBeNull();
  });
});

describe('instant', () => {
  it('reads an ISO instant, and anything else as null', () => {
    expect(instant('2026-01-02T03:04:05.000Z')?.toISOString()).toBe('2026-01-02T03:04:05.000Z');
    expect(instant('not a date')).toBeNull();
    expect(instant(null)).toBeNull();
  });
});

describe('legacyUuid', () => {
  it('gives the same id on every run, so re-runs skip existing rows', () => {
    expect(legacyUuid('orders', '1286')).toBe(legacyUuid('orders', '1286'));
  });

  it('gives different ids to different records and kinds', () => {
    expect(legacyUuid('orders', '1286')).not.toBe(legacyUuid('orders', '1287'));
    expect(legacyUuid('orders', '1286')).not.toBe(legacyUuid('products', '1286'));
  });

  it('uses the version 5 layout', () => {
    expect(legacyUuid('orders', '1286')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
