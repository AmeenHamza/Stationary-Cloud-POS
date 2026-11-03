import { MAX_PIECES_PER_BOX } from '@pos/contracts';

import { DomainRuleError } from '../errors.js';

import type { SaleUnit } from '@pos/contracts';

function assertPiecesPerBox(piecesPerBox: number): void {
  if (!Number.isInteger(piecesPerBox) || piecesPerBox < 1 || piecesPerBox > MAX_PIECES_PER_BOX) {
    throw new DomainRuleError(
      'BAD_USER_INPUT',
      'Pieces per box must be a whole number ≥ 1',
      'piecesPerBox',
    );
  }
}

/** Stock pieces represented by one unit sold: 1 for PIECE, pieces-per-box for BOX (BR-01, BR-22). */
export function piecesPerUnit(unit: SaleUnit, piecesPerBox: number): number {
  assertPiecesPerBox(piecesPerBox);
  return unit === 'BOX' ? piecesPerBox : 1;
}

/** Pieces added by a restock of `boxes` full boxes plus loose `pieces` (F-10). */
export function restockPieces(boxes: number, pieces: number, piecesPerBox: number): number {
  assertPiecesPerBox(piecesPerBox);
  const whole = [boxes, pieces].every((n) => Number.isInteger(n) && n >= 0);
  const total = boxes * piecesPerBox + pieces;
  if (!whole || total < 1) {
    throw new DomainRuleError('BAD_USER_INPUT', 'Restock at least one piece', 'pieces');
  }
  return total;
}

/** Low-stock threshold entered in pieces or boxes, stored in pieces (DATABASE.md §4.5). */
export function thresholdToPieces(value: number, unit: SaleUnit, piecesPerBox: number): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new DomainRuleError(
      'BAD_USER_INPUT',
      'Threshold must be a whole number ≥ 0',
      'lowStockThreshold',
    );
  }
  return value * piecesPerUnit(unit, piecesPerBox);
}

/** A threshold stored in pieces, expressed in the unit it was entered in (edit forms). */
export function piecesToThreshold(pieces: number, unit: SaleUnit, piecesPerBox: number): number {
  return Math.floor(pieces / piecesPerUnit(unit, piecesPerBox));
}

/**
 * Stock in full boxes and loose pieces, for display ("2 boxes + 3 pcs"). Negative stock (D-16) is
 * shown in pieces only, as `boxes: 0`.
 */
export function splitPieces(
  pieces: number,
  piecesPerBox: number,
): { boxes: number; pieces: number } {
  assertPiecesPerBox(piecesPerBox);
  if (pieces <= 0 || piecesPerBox === 1) {
    return { boxes: 0, pieces };
  }
  return { boxes: Math.floor(pieces / piecesPerBox), pieces: pieces % piecesPerBox };
}
