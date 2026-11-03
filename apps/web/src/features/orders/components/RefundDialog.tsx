'use client';

import { formatRs, money } from '@pos/domain';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { useRefund } from '../hooks/useRefund';

import { RefundLinesTable } from './RefundLinesTable';

/**
 * Refund All / Refund Items (F-16, `#17`). Refunds always restock (D-14); an Udhaar bill's refund
 * goes back to the customer's khata (A-03). Amounts are priced with the API's refund function.
 */
export function RefundDialog({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const refund = useRefund(orderId, onClose);
  const { order } = refund;
  const units = refund.selected.reduce((count, line) => count + line.quantity, 0);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Refund {order?.billNumber ?? 'bill'}</DialogTitle>
          <DialogDescription>
            {order == null
              ? 'Loading the bill…'
              : `Total ${formatRs(order.total)} · already refunded ${formatRs(order.refundedTotal)} · net ${formatRs(money(order.total).minus(money(order.refundedTotal)))}`}
          </DialogDescription>
        </DialogHeader>
        {order != null && (
          <div className="grid gap-4">
            {order.paymentMethod === 'UDHAAR' && (
              <p className="text-sm text-muted-foreground">
                Udhaar bill: the refund is credited to {order.customerName ?? 'the customer'}’s
                khata.
              </p>
            )}
            <RefundLinesTable
              lines={order.lines}
              quantities={refund.quantities}
              onQuantity={refund.setQuantity}
            />
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Button variant="outline" size="sm" onClick={refund.selectAll}>
                Select all remaining
              </Button>
              <Button variant="ghost" size="sm" onClick={refund.clear}>
                Clear
              </Button>
              <span className="text-muted-foreground">
                {units} unit(s) selected across {refund.selected.length} item line(s)
              </span>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="refund-reason">Reason (optional)</Label>
              <Input
                id="refund-reason"
                maxLength={200}
                value={refund.reason}
                onChange={(event) => {
                  refund.setReason(event.target.value);
                }}
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                disabled={refund.loading || refund.selectedAmount === null}
                onClick={() => void refund.submit(false)}
              >
                Refund Selected
                {refund.selectedAmount !== null && ` · ${formatRs(refund.selectedAmount)}`}
              </Button>
              <Button
                variant="destructive"
                disabled={refund.loading || refund.allAmount === null}
                onClick={() => void refund.submit(true)}
              >
                Refund All{refund.allAmount !== null && ` · ${formatRs(refund.allAmount)}`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
