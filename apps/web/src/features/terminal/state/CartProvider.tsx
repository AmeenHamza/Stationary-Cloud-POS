'use client';

import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';

import { useViewer } from '@/features/auth';

import { cartReducer } from './cart.reducer';
import { loadCart, saveCart } from './cart.storage';

import type { CartAction, CartState } from './cart.types';
import type { Dispatch, ReactNode } from 'react';

interface CartContextValue {
  cart: CartState;
  dispatch: Dispatch<CartAction>;
}

const CartContext = createContext<CartContextValue | null>(null);

/**
 * The cashier's cart (SYSTEM_DESIGN.md §3.1): restored from this browser for this user, saved on
 * every change, and cleared only after a confirmed sale. It holds no prices.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const { id: userId } = useViewer();
  const [cart, dispatch] = useReducer(cartReducer, userId, loadCart);
  useEffect(() => {
    saveCart(userId, cart);
  }, [userId, cart]);
  const value = useMemo(() => ({ cart, dispatch }), [cart]);
  return <CartContext value={value}>{children}</CartContext>;
}

export function useCart(): CartContextValue {
  const value = useContext(CartContext);
  if (value === null) {
    throw new Error('useCart must be used inside <CartProvider>');
  }
  return value;
}
