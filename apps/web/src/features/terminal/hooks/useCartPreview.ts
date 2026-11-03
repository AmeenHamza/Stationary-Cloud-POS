'use client';

import { useMemo } from 'react';

import { useDefaultBillGstRate } from '@/features/settings';

import { previewCart, type CartPreview } from '../state/cart-preview';
import { useCart } from '../state/CartProvider';

import { useCartProducts } from './useCartProducts';

/** The cart priced from the live cache with the shared domain function (ADR-013). */
export function useCartPreview(): CartPreview & { gstRate: string } {
  const { cart } = useCart();
  const products = useCartProducts(cart.lines);
  const defaultRate = useDefaultBillGstRate();
  const gstRate = cart.billGst.rate ?? defaultRate ?? '';
  return useMemo(
    () => ({ ...previewCart(cart, products, gstRate), gstRate }),
    [cart, products, gstRate],
  );
}
