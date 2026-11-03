import { DISCOUNT_TYPES, PAYMENT_METHODS } from '@pos/contracts';
import { customSaleLineInputSchema, saleLineInputSchema } from '@pos/validation';

import { safeLocalStorage } from '@/lib/storage/safe-local-storage';

import { EMPTY_CART, type CartState } from './cart.types';

const cartKey = (userId: string): string => `pos:cart:${userId}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

const oneOf = <T extends string>(options: readonly T[], value: unknown, fallback: T): T =>
  options.find((option) => option === value) ?? fallback;

/**
 * Rebuilds a saved cart, keeping only what is still well-formed: another version of the app, or a
 * hand-edited value, must never break the terminal. Lines are checked with the API's line schema.
 */
export function restoreCart(value: unknown): CartState {
  if (!isRecord(value) || !Array.isArray(value['lines'])) {
    return EMPTY_CART;
  }
  const lines = value['lines'].flatMap((line: unknown) => {
    const parsed = saleLineInputSchema.safeParse(line);
    return parsed.success ? [parsed.data] : [];
  });
  const customLines = Array.isArray(value['customLines'])
    ? value['customLines'].flatMap((line: unknown, index) => {
        const parsed = customSaleLineInputSchema.safeParse(line);
        return parsed.success ? [{ ...parsed.data, id: `custom-${String(index)}` }] : [];
      })
    : [];
  const discount = isRecord(value['discount']) ? value['discount'] : {};
  const billGst = isRecord(value['billGst']) ? value['billGst'] : {};
  const customer = isRecord(value['customer']) ? value['customer'] : null;
  const paymentMethod = oneOf(PAYMENT_METHODS, value['paymentMethod'], 'CASH');
  return {
    lines,
    customLines,
    discount: {
      type: oneOf(DISCOUNT_TYPES, discount['type'], 'NONE'),
      amount: text(discount['amount']),
      percent: text(discount['percent']),
    },
    billGst: {
      applied: billGst['applied'] === true,
      rate: typeof billGst['rate'] === 'string' ? billGst['rate'] : null,
    },
    paymentMethod,
    customer:
      paymentMethod === 'UDHAAR' && customer !== null && text(customer['id']) !== ''
        ? { id: text(customer['id']), name: text(customer['name']) }
        : null,
  };
}

/** The cart saved for this user on this browser (SYSTEM_DESIGN.md §3.1), or an empty one. */
export function loadCart(userId: string): CartState {
  const raw = safeLocalStorage.get(cartKey(userId));
  if (raw === null) {
    return EMPTY_CART;
  }
  try {
    return restoreCart(JSON.parse(raw));
  } catch {
    return EMPTY_CART;
  }
}

/** Saves on every change; an empty cart removes the key. */
export function saveCart(userId: string, cart: CartState): void {
  if (cart === EMPTY_CART) {
    safeLocalStorage.remove(cartKey(userId));
    return;
  }
  safeLocalStorage.set(cartKey(userId), JSON.stringify(cart));
}
