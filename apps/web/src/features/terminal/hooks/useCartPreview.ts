'use client';

import { useEffect, useMemo } from 'react';
import { toast } from 'sonner';

import { useDefaultBillGstRate } from '@/features/settings';

import { previewCart, type CartPreview } from '../state/cart-preview';
import { useCart } from '../state/CartProvider';

import { useCartProducts } from './useCartProducts';

/**
 * The cart priced from the live cache with the shared domain function (ADR-013). A product an admin
 * deleted while it was in the cart can no longer be sold, so its lines leave the cart (D-28).
 */
export function useCartPreview(): CartPreview & { gstRate: string } {
  const { cart, dispatch } = useCart();
  const { products, missing } = useCartProducts(cart.lines);
  const defaultRate = useDefaultBillGstRate();
  const gstRate = cart.billGst.rate ?? defaultRate ?? '';
  useEffect(() => {
    if (missing.length > 0) {
      dispatch({ type: 'removeProducts', productIds: missing });
      toast.error('A deleted product was removed from the cart.');
    }
  }, [missing, dispatch]);
  return useMemo(
    () => ({ ...previewCart(cart, products, gstRate), gstRate }),
    [cart, products, gstRate],
  );
}
