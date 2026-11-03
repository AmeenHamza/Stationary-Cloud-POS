import { describe, expect, it } from 'vitest';

import { balanceState, ledgerDelta } from './khata/ledger.js';
import { formatBillNumber, parseBillNumber } from './numbering/bill-number.js';
import { crossesLowStockThreshold, isLowStock, isOutOfStock } from './stock/low-stock.js';
import { normalizeNameKey, phoneDigits } from './text/normalize.js';
import {
  piecesPerUnit,
  piecesToThreshold,
  restockPieces,
  splitPieces,
  thresholdToPieces,
} from './units/pieces.js';

describe('units (BR-01, BR-22)', () => {
  it('converts boxes to pieces', () => {
    expect(piecesPerUnit('PIECE', 12)).toBe(1);
    expect(piecesPerUnit('BOX', 12)).toBe(12);
    expect(restockPieces(2, 5, 12)).toBe(29);
    expect(thresholdToPieces(3, 'BOX', 10)).toBe(30);
    expect(thresholdToPieces(0, 'PIECE', 1)).toBe(0);
  });

  it('shows stored pieces back in boxes and loose pieces', () => {
    expect(piecesToThreshold(30, 'BOX', 10)).toBe(3);
    expect(piecesToThreshold(7, 'PIECE', 10)).toBe(7);
    expect(splitPieces(27, 12)).toEqual({ boxes: 2, pieces: 3 });
    expect(splitPieces(24, 12)).toEqual({ boxes: 2, pieces: 0 });
    expect(splitPieces(5, 1)).toEqual({ boxes: 0, pieces: 5 });
    expect(splitPieces(-4, 12)).toEqual({ boxes: 0, pieces: -4 });
    expect(() => splitPieces(5, 0)).toThrow(/Pieces per box/);
  });

  it('rejects invalid quantities', () => {
    expect(() => piecesPerUnit('BOX', 0)).toThrow(/Pieces per box/);
    expect(() => restockPieces(0, 0, 1)).toThrow(/at least one/);
    expect(() => restockPieces(-1, 5, 1)).toThrow(/at least one/);
    expect(() => thresholdToPieces(-1, 'PIECE', 1)).toThrow(/Threshold/);
    expect(() => thresholdToPieces(1.5, 'PIECE', 1)).toThrow(/Threshold/);
  });
});

describe('low stock (BR-02)', () => {
  it('flags stock at or below the threshold, matching the old app (5 of 5 is low)', () => {
    expect(isLowStock(5, 5)).toBe(true);
    expect(isLowStock(6, 5)).toBe(false);
    expect(isLowStock(-3, 0)).toBe(true);
    expect(isOutOfStock(0)).toBe(true);
    expect(isOutOfStock(-1)).toBe(true);
    expect(isOutOfStock(1)).toBe(false);
  });

  it('detects threshold crossings in both directions', () => {
    expect(crossesLowStockThreshold(6, 5, 5)).toBe(true);
    expect(crossesLowStockThreshold(5, 6, 5)).toBe(true);
    expect(crossesLowStockThreshold(9, 7, 5)).toBe(false);
  });
});

describe('bill numbers (BR-05)', () => {
  it('formats ORD-YYYYMMDD-NNN with at least three digits', () => {
    expect(formatBillNumber('2026-10-28', 49)).toBe('ORD-20261028-049');
    expect(formatBillNumber('2026-10-28', 1234)).toBe('ORD-20261028-1234');
    expect(() => formatBillNumber('2026-13-01', 1)).toThrow();
    expect(() => formatBillNumber('2026-10-28', 0)).toThrow();
  });

  it('parses valid numbers and rejects others', () => {
    expect(parseBillNumber('ORD-20261028-045')).toEqual({
      businessDate: '2026-10-28',
      sequence: 45,
    });
    expect(parseBillNumber('ORD-20261332-045')).toBeNull();
    expect(parseBillNumber('INV-1')).toBeNull();
  });
});

describe('text normalization', () => {
  it('builds name keys for sorting and search', () => {
    expect(normalizeNameKey('  Deli   Gel RED ')).toBe('deli gel red');
  });

  it('extracts phone digits', () => {
    expect(phoneDigits('0300 000-0000')).toBe('03000000000');
    expect(phoneDigits('')).toBeNull();
    expect(phoneDigits(null)).toBeNull();
    expect(phoneDigits(undefined)).toBeNull();
  });
});

describe('khata amounts (DATABASE.md §4.8, Q25)', () => {
  it('signs entries: credits and purchases raise the balance, payments lower it', () => {
    expect(ledgerDelta('500.00', true).toString()).toBe('500');
    expect(ledgerDelta('500.50', false).toString()).toBe('-500.5');
    expect(() => ledgerDelta('1.005', true)).toThrow(/at most 2 decimals/);
  });

  it('describes a balance as owed, advance or settled', () => {
    expect(balanceState('2450.00')).toEqual({ state: 'owed', magnitude: '2450.00' });
    expect(balanceState('-75.5')).toEqual({ state: 'advance', magnitude: '75.50' });
    expect(balanceState('0.00')).toEqual({ state: 'settled', magnitude: '0.00' });
  });
});
