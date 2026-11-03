'use client';

import { CloudOffIcon } from 'lucide-react';

import { formatRs } from '@pos/domain';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCan } from '@/features/auth';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { newIdempotencyKey } from '@/lib/ids/idempotency-key';

import { useCart } from '../state/CartProvider';
import { saleInputOf } from '../state/sale-input';

import { BillGstField } from './BillGstField';
import { DiscountField } from './DiscountField';
import { PaymentMethodPicker } from './PaymentMethodPicker';
import { TotalsSummary } from './TotalsSummary';

import type { SaleFlow } from '../hooks/useCreateSale';
import type { CartPreview } from '../state/cart-preview';

/**
 * Payment (`#43`, `#44`, F-20–F-22): totals, discount, Bill GST, method and, for Udhaar, the
 * customer. "Process Payment" is disabled while offline (D-05) and while an earlier sale is still
 * unconfirmed, so a sale is never sent twice under different keys.
 */
export function PaymentDialog({
  open,
  onOpenChange,
  preview,
  sale,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: CartPreview & { gstRate: string };
  sale: SaleFlow;
}) {
  const { cart } = useCart();
  const online = useOnlineStatus();
  const canDiscount = useCan('sales:discount');
  const ready = saleInputOf(cart, preview, '') !== null;
  const total = preview.bill === null ? null : formatRs(preview.bill.total);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Payment</DialogTitle>
        </DialogHeader>
        <div className="grid gap-5">
          <TotalsSummary bill={preview.bill} />
          {preview.entryError !== null && (
            <p className="text-sm text-destructive" role="alert">
              {preview.entryError}
            </p>
          )}
          {canDiscount && <DiscountField />}
          <BillGstField rate={preview.gstRate} />
          <PaymentMethodPicker />
          {!online && (
            <p className="flex items-center gap-2 text-sm font-medium text-destructive">
              <CloudOffIcon className="size-4" aria-hidden /> Offline: billing paused.
            </p>
          )}
          <Button
            size="lg"
            variant="brand"
            disabled={!online || !ready || sale.pending !== null}
            onClick={() => {
              const input = saleInputOf(cart, preview, newIdempotencyKey());
              if (input !== null) {
                sale.submit(input);
                onOpenChange(false);
              }
            }}
          >
            Process Payment{total !== null && ` · ${total}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
