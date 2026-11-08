import { DISCOUNT_TYPES, PAYMENT_METHODS } from '@pos/contracts';
import { customSaleLineInputSchema, saleLineInputSchema } from '@pos/validation';

import { safeLocalStorage } from '@/lib/storage/safe-local-storage';

import { EMPTY_CART, type CartDiscount, type CartState } from './cart.types';

const cartKey = (userId: string): string => `pos:cart:${userId}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

const oneOf = <T extends string>(options: readonly T[], value: unknown, fallback: T): T =>
  options.find((option) => option === value) ?? fallback;

function discountOf(value: unknown): CartDiscount {
  const discount = isRecord(value) ? value : {};
  return {
    type: oneOf(DISCOUNT_TYPES, discount['type'], 'NONE'),
    amount: text(discount['amount']),
    percent: text(discount['percent']),
  };
}

/**
 * Splits a saved line into its fields, for the API's line schema, and its discount as typed. A half
 * typed discount is still a good draft, so it must not cost the cashier the line.
 */
function splitDiscount(line: unknown): { fields: unknown; own: { discount?: CartDiscount } } {
  if (!isRecord(line)) {
    return { fields: line, own: {} };
  }
  const discount = discountOf(line['discount']);
  return {
    fields: { ...line, discount: null },
    own: discount.type === 'NONE' ? {} : { discount },
  };
}

/**
 * Rebuilds a saved cart, keeping only what is still well-formed: another version of the app, or a
 * hand-edited value, must never break the terminal. Lines are checked with the API's line schema.
 */
export function restoreCart(value: unknown): CartState {
  if (!isRecord(value) || !Array.isArray(value['lines'])) {
    return EMPTY_CART;
  }
  const lines = value['lines'].flatMap((line: unknown) => {
    const { fields, own } = splitDiscount(line);
    const parsed = saleLineInputSchema.safeParse(fields);
    if (!parsed.success) {
      return [];
    }
    const { productId, unit, quantity } = parsed.data;
    return [{ productId, unit, quantity, ...own }];
  });
  const customLines = Array.isArray(value['customLines'])
    ? value['customLines'].flatMap((line: unknown, index) => {
        const { fields, own } = splitDiscount(line);
        const parsed = customSaleLineInputSchema.safeParse(fields);
        if (!parsed.success) {
          return [];
        }
        const { name, unit, quantity, unitPrice, taxRate } = parsed.data;
        const id = `custom-${String(index)}`;
        return [{ id, name, unit, quantity, unitPrice, taxRate, ...own }];
      })
    : [];
  const billGst = isRecord(value['billGst']) ? value['billGst'] : {};
  const customer = isRecord(value['customer']) ? value['customer'] : null;
  const paymentMethod = oneOf(PAYMENT_METHODS, value['paymentMethod'], 'CASH');
  return {
    lines,
    customLines,
    discount: discountOf(value['discount']),
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
