import { describe, expect, it } from 'vitest';

import {
  addVendorPurchaseInputSchema,
  createCustomerInputSchema,
  customerLedgerArgsSchema,
  partiesArgsSchema,
  receiveCustomerPaymentInputSchema,
} from './khata.schemas.js';

const KEY = '0192f0c1-0000-7000-8000-000000000001';
const ID = '0192f0c1-0000-7000-8000-000000000002';

describe('khata inputs (F-25, F-26)', () => {
  it('normalizes empty optional contact fields to null', () => {
    expect(
      createCustomerInputSchema.parse({ name: ' Ali ', phone: '', email: '', address: '' }),
    ).toEqual({ name: 'Ali', phone: null, email: null, address: null });
    expect(createCustomerInputSchema.safeParse({ name: '' }).success).toBe(false);
    expect(createCustomerInputSchema.safeParse({ name: 'A', email: 'nope' }).success).toBe(false);
  });

  it('takes payments in a real method and a positive amount, never Udhaar', () => {
    const payment = { idempotencyKey: KEY, customerId: ID, amount: '500.00', method: 'CASH' };
    expect(receiveCustomerPaymentInputSchema.safeParse(payment).success).toBe(true);
    expect(
      receiveCustomerPaymentInputSchema.safeParse({ ...payment, method: 'UDHAAR' }).success,
    ).toBe(false);
    expect(receiveCustomerPaymentInputSchema.safeParse({ ...payment, amount: '0' }).success).toBe(
      false,
    );
    expect(
      receiveCustomerPaymentInputSchema.safeParse({ ...payment, amount: '1.005' }).success,
    ).toBe(false);
  });

  it('records a vendor purchase as amount plus an optional description (D-20)', () => {
    expect(
      addVendorPurchaseInputSchema.parse({ idempotencyKey: KEY, vendorId: ID, amount: '1200' }),
    ).toMatchObject({ amount: '1200', description: null });
  });

  it('pages lists and ledgers with the shared limits', () => {
    expect(partiesArgsSchema.parse({})).toMatchObject({ first: 50 });
    expect(partiesArgsSchema.safeParse({ first: 51 }).success).toBe(false);
    expect(customerLedgerArgsSchema.safeParse({ customerId: 'x' }).success).toBe(false);
  });
});
