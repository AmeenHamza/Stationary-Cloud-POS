'use client';

import { CircleCheckIcon, PrinterIcon } from 'lucide-react';
import { useState } from 'react';

import { formatRs } from '@pos/domain';

import { ReceiptPrint } from '@/components/receipt/ReceiptPrint';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import type { CompletedSale } from '../hooks/sale-sender';

/**
 * A confirmed sale (F-23): the bill number and total, any above-stock warnings (D-16), and the 80 mm
 * receipt, printed at once for a new sale and on request for one confirmed after a reload.
 */
export function SaleCompleteDialog({
  sale,
  onClose,
}: {
  sale: CompletedSale;
  onClose: () => void;
}) {
  const [prints, setPrints] = useState(sale.autoPrint ? 1 : 0);
  const { receipt } = sale;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CircleCheckIcon className="size-5 text-success" aria-hidden /> Sale complete
          </DialogTitle>
          <DialogDescription>
            {receipt.billNumber} · {formatRs(receipt.total)}
          </DialogDescription>
        </DialogHeader>
        {sale.stockWarnings.length > 0 && (
          <ul className="grid gap-1 text-sm text-warning">
            {sale.stockWarnings.map((warning) => (
              <li key={warning.productId}>
                {warning.productName}: stock is now {warning.stockAfter}. Restock or adjust it.
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setPrints((count) => count + 1);
            }}
          >
            <PrinterIcon /> {prints === 0 ? 'Print receipt' : 'Print again'}
          </Button>
          <Button onClick={onClose}>New sale</Button>
        </div>
        {prints > 0 && <ReceiptPrint receipt={receipt} printCount={prints} />}
      </DialogContent>
    </Dialog>
  );
}
