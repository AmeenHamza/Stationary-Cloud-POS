import { text } from './values.js';

import type { PaymentMethod } from '@pos/contracts';

/** The old app's method names (seen: cash, card, udhaar, bank_transfer), ignoring case and spacing. */
const METHODS: Readonly<Record<string, PaymentMethod>> = {
  cash: 'CASH',
  card: 'CARD',
  easypaisa: 'EASYPAISA',
  jazzcash: 'JAZZCASH',
  banktransfer: 'BANK_TRANSFER',
  bank: 'BANK_TRANSFER',
  udhaar: 'UDHAAR',
};

/** The new method; `null` when the old value is empty, `undefined` when it is not recognised. */
export function paymentMethodOf(value: string | null): PaymentMethod | null | undefined {
  const raw = text(value);
  if (raw === null) {
    return null;
  }
  return METHODS[raw.toLowerCase().replace(/[^a-z]/g, '')];
}
