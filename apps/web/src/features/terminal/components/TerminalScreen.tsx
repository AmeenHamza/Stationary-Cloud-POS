'use client';

import { useCreateSale } from '../hooks/useCreateSale';

import { CartPanel } from './CartPanel';
import { PendingSaleBanner } from './PendingSaleBanner';
import { ProductPicker } from './ProductPicker';
import { SaleCompleteDialog } from './SaleCompleteDialog';

/**
 * Billing terminal body (F-18–F-23): products on the left, the cart on the right, the state of an
 * unconfirmed sale above both, and the receipt once a sale is confirmed.
 */
export function TerminalScreen() {
  const sale = useCreateSale();
  return (
    <main className="grid flex-1 items-start gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_25rem]">
      <PendingSaleBanner sale={sale} />
      <ProductPicker />
      <CartPanel sale={sale} />
      {sale.completed !== null && (
        <SaleCompleteDialog sale={sale.completed} onClose={sale.dismiss} />
      )}
    </main>
  );
}
