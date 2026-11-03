import { z } from 'zod';

import {
  DISCOUNT_TYPES,
  MAX_LINES_PER_SALE,
  MAX_QUANTITY_PER_LINE,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  SALE_UNITS,
} from '@pos/contracts';

import {
  businessDateSchema,
  idempotencyKeySchema,
  idSchema,
  moneySchema,
  optionalText,
  percentSchema,
} from './common.js';
import { pageArgsSchema } from './pagination.schemas.js';

const quantity = z
  .int({ error: 'Quantity must be a whole number' })
  .min(1, { error: 'Quantity must be at least 1' })
  .max(MAX_QUANTITY_PER_LINE, { error: `At most ${String(MAX_QUANTITY_PER_LINE)} per line` });

/** One cart line: the server reads prices from the locked product row, never from the client. */
export const saleLineInputSchema = z.object({
  productId: idSchema,
  unit: z.enum(SALE_UNITS),
  quantity,
});

export const customSaleLineInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  unit: z.enum(SALE_UNITS),
  quantity,
  unitPrice: moneySchema,
  taxRate: percentSchema,
});

/** Bill discount (BR-06): flat rupees or a percentage of the subtotal. */
export const discountInputSchema = z
  .object({
    type: z.enum(DISCOUNT_TYPES),
    amount: moneySchema.nullish(),
    percent: percentSchema.nullish(),
  })
  .refine((d) => d.type !== 'FLAT' || d.amount != null, {
    error: 'Enter the discount amount',
    path: ['amount'],
  })
  .refine((d) => d.type !== 'PERCENT' || d.percent != null, {
    error: 'Enter the discount percentage',
    path: ['percent'],
  });

/** Bill GST (BR-07): optional per bill, rate editable (default from settings). */
export const billGstInputSchema = z
  .object({ applied: z.boolean(), rate: percentSchema.nullish() })
  .refine((g) => !g.applied || g.rate != null, { error: 'Enter the GST rate', path: ['rate'] });

/** `createSale` [K] (API.md §10.2): 1–100 lines, no duplicate (product, unit) pair (Q34). */
export const createSaleInputSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  lines: z
    .array(saleLineInputSchema)
    .max(MAX_LINES_PER_SALE, { error: `At most ${String(MAX_LINES_PER_SALE)} lines` })
    .refine(
      (lines) =>
        new Set(lines.map((line) => `${line.productId}:${line.unit}`)).size === lines.length,
      { error: 'Each product and unit may appear once' },
    ),
  customLines: z.array(customSaleLineInputSchema).max(MAX_LINES_PER_SALE).nullish(),
  discount: discountInputSchema,
  billGst: billGstInputSchema,
  paymentMethod: z.enum(PAYMENT_METHODS, { error: 'Choose a payment method' }),
  customerId: idSchema.nullish().transform((value) => value ?? null),
  expectedTotal: moneySchema,
}).refine((input) => input.lines.length + (input.customLines?.length ?? 0) > 0, {
  error: 'Add at least one item',
  path: ['lines'],
}).refine((input) => input.lines.length + (input.customLines?.length ?? 0) <= MAX_LINES_PER_SALE, {
  error: `At most ${String(MAX_LINES_PER_SALE)} lines`,
  path: ['lines'],
});
export type CreateSaleInput = z.output<typeof createSaleInputSchema>;

/** An order line id (bigint, sent as an ID string). */
export const orderLineIdSchema = z.string().regex(/^\d{1,18}$/, { error: 'Invalid line' });

/** `refundOrder` [K] (F-16): exactly one of `lines` / `refundAll`; amount checked against the server. */
export const refundOrderInputSchema = z
  .object({
    idempotencyKey: idempotencyKeySchema,
    orderId: idSchema,
    lines: z
      .array(z.object({ orderLineId: orderLineIdSchema, quantity }))
      .max(MAX_LINES_PER_SALE)
      .nullish()
      .transform((value) => value ?? []),
    refundAll: z
      .boolean()
      .nullish()
      .transform((value) => value === true),
    reason: optionalText(200, 'Reason'),
    expectedAmount: moneySchema,
  })
  .refine((r) => r.refundAll !== r.lines.length > 0, {
    error: 'Refund everything or pick the items to refund',
    path: ['lines'],
  });
export type RefundOrderInput = z.output<typeof refundOrderInputSchema>;

/** `orders(filter, first, after)`: newest first; 90 days by default (D-12, F-35). */
export const ordersArgsSchema = pageArgsSchema.extend({
  filter: z
    .object({
      billNumberPrefix: z.string().trim().min(1).max(24).toUpperCase().nullish(),
      status: z.enum(ORDER_STATUSES).nullish(),
      from: businessDateSchema.nullish(),
      to: businessDateSchema.nullish(),
      customerId: idSchema.nullish(),
      includeArchived: z.boolean().nullish(),
    })
    .nullish(),
});
export type OrdersArgs = z.output<typeof ordersArgsSchema>;
