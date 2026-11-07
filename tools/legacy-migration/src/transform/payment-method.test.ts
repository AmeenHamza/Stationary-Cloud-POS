import { describe, expect, it } from 'vitest';

import { paymentMethodOf } from './payment-method.js';

describe('paymentMethodOf', () => {
  it('maps the old names, ignoring case and spacing', () => {
    expect(paymentMethodOf('cash')).toBe('CASH');
    expect(paymentMethodOf('CARD')).toBe('CARD');
    expect(paymentMethodOf('Easy Paisa')).toBe('EASYPAISA');
    expect(paymentMethodOf('jazzcash')).toBe('JAZZCASH');
    expect(paymentMethodOf(' bank_transfer ')).toBe('BANK_TRANSFER');
    expect(paymentMethodOf('bank')).toBe('BANK_TRANSFER');
    expect(paymentMethodOf('Udhaar')).toBe('UDHAAR');
  });

  it('gives null for an empty value', () => {
    expect(paymentMethodOf(null)).toBeNull();
    expect(paymentMethodOf('   ')).toBeNull();
  });

  it('gives undefined for a method it does not recognise', () => {
    expect(paymentMethodOf('cheque')).toBeUndefined();
  });
});
