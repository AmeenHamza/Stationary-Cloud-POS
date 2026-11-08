import { toMoneyString } from '@pos/domain';

import type { CartPreview } from './cart-preview';
import type { CartDiscount, CartState } from './cart.types';
import type { CreateSaleInput, DiscountInput } from '@/graphql/__generated__/graphql';

/** The value matching the type, as the API expects it. */
function discountInput({ type, amount, percent }: CartDiscount): DiscountInput {
  return type === 'FLAT' ? { type, amount } : type === 'PERCENT' ? { type, percent } : { type };
}

/** An item's discount, left out when it has none (D-27). */
function lineDiscount(discount: CartDiscount | undefined): { discount?: DiscountInput } {
  return discount === undefined || discount.type === 'NONE'
    ? {}
    : { discount: discountInput(discount) };
}

/**
 * The `createSale` input for a priced cart: lines without prices, the discounts and Bill GST as
 * entered, and the previewed total as `expectedTotal` (PRICE_CHANGED if the server's differs).
 * Null while the cart cannot be sold (loading, unsellable line, invalid entry, no Udhaar customer).
 */
export function saleInputOf(
  cart: CartState,
  preview: CartPreview & { gstRate: string },
  idempotencyKey: string,
): CreateSaleInput | null {
  const udhaar = cart.paymentMethod === 'UDHAAR';
  if (preview.bill === null || (udhaar && cart.customer === null)) {
    return null;
  }
  return {
    idempotencyKey,
    lines: cart.lines.map(({ productId, unit, quantity, discount }) => ({
      productId,
      unit,
      quantity,
      ...lineDiscount(discount),
    })),
    customLines: cart.customLines.map(({ name, unit, quantity, unitPrice, taxRate, discount }) => ({
      name: name.trim() === '' ? 'Custom item' : name.trim(),
      unit,
      quantity,
      unitPrice,
      taxRate,
      ...lineDiscount(discount),
    })),
    discount: discountInput(cart.discount),
    billGst: cart.billGst.applied ? { applied: true, rate: preview.gstRate } : { applied: false },
    paymentMethod: cart.paymentMethod,
    customerId: udhaar ? (cart.customer?.id ?? null) : null,
    expectedTotal: toMoneyString(preview.bill.total),
  };
}
