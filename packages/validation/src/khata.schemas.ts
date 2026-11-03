import { z } from 'zod';

import { PAYMENT_METHODS } from '@pos/contracts';

import {
  emailSchema,
  idempotencyKeySchema,
  idSchema,
  optionalText,
  phoneSchema,
  positiveMoneySchema,
  requiredText,
  searchSchema,
  versionSchema,
} from './common.js';
import { pageArgsSchema } from './pagination.schemas.js';

/** Contact fields shared by customers and vendors (FEATURES.md §3.9–3.10). */
const partyFields = {
  name: requiredText(120, 'Name'),
  phone: phoneSchema,
  email: emailSchema,
  address: optionalText(300, 'Address'),
};

/** Khata payments use a real payment method; Udhaar is credit, not a payment (DATABASE.md §4.8). */
export const khataPaymentMethodSchema = z
  .enum(PAYMENT_METHODS, { error: 'Choose a payment method' })
  .refine((method) => method !== 'UDHAAR', { error: 'Udhaar is not a payment method here' });

const note = optionalText(300, 'Note');

/** `customers` / `vendors(filter: { search, withBalanceOnly, includeArchived }, first, after)`. */
export const partiesArgsSchema = pageArgsSchema.extend({
  filter: z
    .object({
      search: searchSchema.nullish(),
      withBalanceOnly: z.boolean().nullish(),
      includeArchived: z.boolean().nullish(),
    })
    .nullish(),
});
export type PartiesArgs = z.output<typeof partiesArgsSchema>;

/** Ledger pages are newest first and cover the last 90 days unless `includeArchived` (D-12, F-35). */
const ledgerWindow = { includeArchived: z.boolean().nullish() };

/** `customerLedger(customerId, includeArchived, first, after)`. */
export const customerLedgerArgsSchema = pageArgsSchema.extend({
  customerId: idSchema,
  ...ledgerWindow,
});
export type CustomerLedgerArgs = z.output<typeof customerLedgerArgsSchema>;

/** `vendorLedger(vendorId, includeArchived, first, after)`. */
export const vendorLedgerArgsSchema = pageArgsSchema.extend({
  vendorId: idSchema,
  ...ledgerWindow,
});
export type VendorLedgerArgs = z.output<typeof vendorLedgerArgsSchema>;

// Customers (F-25)
export const createCustomerInputSchema = z.object(partyFields);
export type CreateCustomerInput = z.output<typeof createCustomerInputSchema>;

export const updateCustomerInputSchema = z.object({
  id: idSchema,
  version: versionSchema,
  ...partyFields,
});
export type UpdateCustomerInput = z.output<typeof updateCustomerInputSchema>;

/** "Add Udhaar" (`MANUAL_CREDIT`, Q25): amount and an optional note. */
export const addCustomerCreditInputSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  customerId: idSchema,
  amount: positiveMoneySchema,
  note,
});
export type AddCustomerCreditInput = z.output<typeof addCustomerCreditInputSchema>;

export const receiveCustomerPaymentInputSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  customerId: idSchema,
  amount: positiveMoneySchema,
  method: khataPaymentMethodSchema,
  note,
});
export type ReceiveCustomerPaymentInput = z.output<typeof receiveCustomerPaymentInputSchema>;

// Vendors (F-26)
const vendorFields = { ...partyFields, productsSupplied: optionalText(300, 'Products supplied') };

export const createVendorInputSchema = z.object(vendorFields);
export type CreateVendorInput = z.output<typeof createVendorInputSchema>;

export const updateVendorInputSchema = z.object({
  id: idSchema,
  version: versionSchema,
  ...vendorFields,
});
export type UpdateVendorInput = z.output<typeof updateVendorInputSchema>;

/** "Add Purchase (Maal Khareeda)": amount and description only; stock is not touched (D-20). */
export const addVendorPurchaseInputSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  vendorId: idSchema,
  amount: positiveMoneySchema,
  description: optionalText(300, 'Description'),
});
export type AddVendorPurchaseInput = z.output<typeof addVendorPurchaseInputSchema>;

export const payVendorInputSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  vendorId: idSchema,
  amount: positiveMoneySchema,
  method: khataPaymentMethodSchema,
  note,
});
export type PayVendorInput = z.output<typeof payVendorInputSchema>;
