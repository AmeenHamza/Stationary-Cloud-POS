import { z } from 'zod';

import { ADJUSTMENT_DIRECTIONS, ADJUSTMENT_REASONS, MAX_STOCK_CHANGE_PIECES } from '@pos/contracts';

import { idempotencyKeySchema, idSchema, optionalText } from './common.js';

const count = z
  .int({ error: 'Enter a whole number' })
  .min(0, { error: 'Cannot be negative' })
  .max(MAX_STOCK_CHANGE_PIECES);

/** `restockProduct` [K] (F-10): adds `boxes × piecesPerBox + pieces`, at least one piece. */
export const restockInputSchema = z
  .object({
    idempotencyKey: idempotencyKeySchema,
    productId: idSchema,
    boxes: count,
    pieces: count,
    note: optionalText(200, 'Note'),
  })
  .refine((input) => input.boxes + input.pieces >= 1, {
    error: 'Restock at least one piece',
    path: ['pieces'],
  });
export type RestockInput = z.output<typeof restockInputSchema>;

/** `adjustStock` [K] (D-18, BR-24): admin only; a reason is always required. */
export const adjustStockInputSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  productId: idSchema,
  direction: z.enum(ADJUSTMENT_DIRECTIONS),
  quantityPieces: z
    .int({ error: 'Enter a whole number of pieces' })
    .min(1, { error: 'Adjust at least one piece' })
    .max(MAX_STOCK_CHANGE_PIECES),
  reason: z.enum(ADJUSTMENT_REASONS, { error: 'Choose a reason' }),
  note: optionalText(200, 'Note'),
});
export type AdjustStockInput = z.output<typeof adjustStockInputSchema>;
