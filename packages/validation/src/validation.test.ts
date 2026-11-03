import { describe, expect, it } from 'vitest';

import {
  changePasswordFormSchema,
  changePasswordInputSchema,
  createStaffUserInputSchema,
  emailSchema,
  moneySchema,
  pageArgsSchema,
  staffUsersArgsSchema,
  percentSchema,
  phoneSchema,
  positiveMoneySchema,
  updateShopSettingsInputSchema,
} from './index.js';

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown): boolean =>
  schema.safeParse(value).success;

describe('pagination (mandatory 50-row limit)', () => {
  it('defaults first to 50 and rejects anything above 50', () => {
    expect(pageArgsSchema.parse({})).toEqual({ first: 50 });
    expect(ok(pageArgsSchema, { first: 50 })).toBe(true);
    expect(ok(pageArgsSchema, { first: 51 })).toBe(false);
    expect(ok(pageArgsSchema, { first: 0 })).toBe(false);
    expect(ok(pageArgsSchema, { first: 2.5 })).toBe(false);
    expect(ok(pageArgsSchema, { first: 10, after: '' })).toBe(false);
  });
});

describe('money and percentages', () => {
  it.each(['0', '1', '120.00', '9999999999.99'])('accepts money %s', (value) => {
    expect(ok(moneySchema, value)).toBe(true);
  });

  it.each(['-1', '1.234', '10000000000', 'abc', ''])('rejects money %s', (value) => {
    expect(ok(moneySchema, value)).toBe(false);
  });

  it('requires a positive amount where needed', () => {
    expect(ok(positiveMoneySchema, '0')).toBe(false);
    expect(ok(positiveMoneySchema, '0.01')).toBe(true);
  });

  it('accepts 0–100 percentages with two decimals', () => {
    expect(ok(percentSchema, '18')).toBe(true);
    expect(ok(percentSchema, '100.00')).toBe(true);
    expect(ok(percentSchema, '100.01')).toBe(false);
    expect(ok(percentSchema, '12.345')).toBe(false);
  });
});

describe('contact fields', () => {
  it('normalizes empty optional phone and email to null', () => {
    expect(phoneSchema.parse('')).toBeNull();
    expect(phoneSchema.parse(undefined)).toBeNull();
    expect(phoneSchema.parse('0300 000-0000')).toBe('0300 000-0000');
    expect(ok(phoneSchema, '12')).toBe(false);
    expect(emailSchema.parse(undefined)).toBeNull();
    expect(emailSchema.parse('')).toBeNull();
    expect(ok(emailSchema, 'not-an-email')).toBe(false);
  });
});

describe('staff and auth inputs (F-31, F-03)', () => {
  const valid = {
    username: 'Cashier1',
    fullName: ' Ali ',
    role: 'CASHIER',
    password: 'longenough',
  };

  it('lower-cases usernames and trims names', () => {
    expect(createStaffUserInputSchema.parse(valid)).toMatchObject({
      username: 'cashier1',
      fullName: 'Ali',
    });
  });

  it('rejects bad usernames, short passwords and password = username', () => {
    expect(ok(createStaffUserInputSchema, { ...valid, username: 'a b' })).toBe(false);
    expect(ok(createStaffUserInputSchema, { ...valid, password: 'short' })).toBe(false);
    expect(ok(createStaffUserInputSchema, { ...valid, password: 'CASHIER1' })).toBe(false);
    expect(ok(createStaffUserInputSchema, { ...valid, role: 'OWNER' })).toBe(false);
  });

  it('requires a different new password', () => {
    const same = { currentPassword: 'samepass1', newPassword: 'samepass1' };
    expect(ok(changePasswordInputSchema, same)).toBe(false);
    expect(ok(changePasswordInputSchema, { ...same, newPassword: 'otherpass2' })).toBe(true);
  });

  it('staff list arguments: default page size, max 50, optional filter', () => {
    expect(staffUsersArgsSchema.parse({})).toMatchObject({ first: 50 });
    expect(ok(staffUsersArgsSchema, { first: 51 })).toBe(false);
    expect(ok(staffUsersArgsSchema, { filter: { search: ' ali ', status: 'ACTIVE' } })).toBe(true);
    expect(ok(staffUsersArgsSchema, { filter: { status: 'GONE' } })).toBe(false);
  });

  it('the change-password form also requires the confirmation to match', () => {
    const form = { currentPassword: 'samepass1', newPassword: 'otherpass2' };
    expect(ok(changePasswordFormSchema, { ...form, confirmNewPassword: 'otherpass2' })).toBe(true);
    expect(ok(changePasswordFormSchema, { ...form, confirmNewPassword: 'otherpass3' })).toBe(false);
    expect(
      ok(changePasswordFormSchema, {
        ...form,
        newPassword: 'samepass1',
        confirmNewPassword: 'samepass1',
      }),
    ).toBe(false);
  });
});

describe('shop settings (Q26)', () => {
  it('accepts a valid profile and maps empty optional fields to null', () => {
    const parsed = updateShopSettingsInputSchema.parse({
      shopName: 'Stationery Shop',
      address: '',
      phone: '',
      receiptFooter: 'Thank you!',
      exchangeReturnPolicy: '',
      logoDataUrl: '',
      defaultBillGstRate: '18.00',
      version: 1,
    });
    expect(parsed).toMatchObject({
      address: null,
      phone: null,
      receiptFooter: 'Thank you!',
      exchangeReturnPolicy: null,
      logoDataUrl: null,
    });
  });

  it('accepts a valid logo data url', () => {
    const parsed = updateShopSettingsInputSchema.parse({
      shopName: 'Stationery Shop',
      address: null,
      phone: null,
      receiptFooter: null,
      exchangeReturnPolicy: null,
      logoDataUrl: 'data:image/png;base64,QUJDRA==',
      defaultBillGstRate: '18.00',
      version: 1,
    });
    expect(parsed.logoDataUrl).toBe('data:image/png;base64,QUJDRA==');
  });
});
