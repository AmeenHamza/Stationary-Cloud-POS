'use client';

import { useState } from 'react';

import { safeLocalStorage } from '@/lib/storage/safe-local-storage';

export type ProductView = 'CARD' | 'LIST';

const VIEW_KEY = 'pos:terminal:product-view';

/** Cards or the list (F-38): this counter's choice, remembered in this browser. */
export function useProductView(): { view: ProductView; choose: (view: ProductView) => void } {
  const [view, setView] = useState<ProductView>(() =>
    safeLocalStorage.get(VIEW_KEY) === 'LIST' ? 'LIST' : 'CARD',
  );
  return {
    view,
    choose: (next) => {
      setView(next);
      safeLocalStorage.set(VIEW_KEY, next);
    },
  };
}
