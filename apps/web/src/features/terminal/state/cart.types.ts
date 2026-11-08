import type { DiscountType, PaymentMethod, SaleUnit } from '@pos/contracts';

/** A discount as typed, overall or on one item (D-27): only the value matching `type` is used. */
export interface CartDiscount {
  type: DiscountType;
  amount: string;
  percent: string;
}

export const NO_DISCOUNT: CartDiscount = { type: 'NONE', amount: '', percent: '' };

/** One cart line: no prices, which the preview reads from the live cache (SYSTEM_DESIGN.md §3.1). */
export interface CartLine {
  productId: string;
  unit: SaleUnit;
  quantity: number;
  /** A discount on this item alone (D-27). */
  discount?: CartDiscount;
}

export interface CustomCartLine {
  id: string;
  name: string;
  unit: SaleUnit;
  quantity: number;
  unitPrice: string;
  taxRate: string;
  discount?: CartDiscount;
}

export interface CartState {
  lines: CartLine[];
  customLines: CustomCartLine[];
  discount: CartDiscount;
  /** `rate` null means the shop's default Bill GST rate (Q26). */
  billGst: { applied: boolean; rate: string | null };
  paymentMethod: PaymentMethod;
  /** The Udhaar customer (D-15); the name is only for display. */
  customer: { id: string; name: string } | null;
}

export type CartAction =
  | { type: 'add'; productId: string; unit: SaleUnit }
  | { type: 'addMany'; productId: string; unit: SaleUnit; quantity: number }
  | { type: 'setQuantity'; productId: string; unit: SaleUnit; quantity: number }
  | { type: 'addCustom'; line: CustomCartLine }
  | { type: 'updateCustom'; id: string; patch: Partial<CustomCartLine> }
  | { type: 'removeCustom'; id: string }
  | { type: 'changeUnit'; productId: string; from: SaleUnit; to: SaleUnit }
  | { type: 'remove'; productId: string; unit: SaleUnit }
  /** Every line of products the server says are no longer for sale. */
  | { type: 'removeProducts'; productIds: readonly string[] }
  | { type: 'setDiscount'; discount: CartState['discount'] }
  | { type: 'setLineDiscount'; productId: string; unit: SaleUnit; discount: CartDiscount }
  | { type: 'setBillGst'; billGst: CartState['billGst'] }
  | { type: 'setPaymentMethod'; paymentMethod: PaymentMethod }
  | { type: 'setCustomer'; customer: CartState['customer'] }
  | { type: 'clear' };

export const EMPTY_CART: CartState = {
  lines: [],
  customLines: [],
  discount: NO_DISCOUNT,
  billGst: { applied: false, rate: null },
  paymentMethod: 'CASH',
  customer: null,
};
