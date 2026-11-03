import { toMoneyString } from '@pos/domain';

import type { CartPreview } from './cart-preview';
import type { CartState } from './cart.types';
import type { CreateSaleInput } from '@/graphql/__generated__/graphql';

/**
 * The `createSale` input for a priced cart: lines without prices, the discount and Bill GST as
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
  const { type, amount, percent } = cart.discount;
  return {
    idempotencyKey,
    lines: cart.lines.map(({ productId, unit, quantity }) => ({ productId, unit, quantity })),
    customLines: cart.customLines.map(({ name, unit, quantity, unitPrice, taxRate }) => ({
      name: name.trim() === '' ? 'Custom item' : name.trim(),
      unit,
      quantity,
      unitPrice,
      taxRate,
    })),
    discount:
      type === 'FLAT' ? { type, amount } : type === 'PERCENT' ? { type, percent } : { type },
    billGst: cart.billGst.applied ? { applied: true, rate: preview.gstRate } : { applied: false },
    paymentMethod: cart.paymentMethod,
    customerId: udhaar ? (cart.customer?.id ?? null) : null,
    expectedTotal: toMoneyString(preview.bill.total),
  };
}
