'use client';

import { Undo2Icon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OrdersPanel } from '@/features/orders';

/** The terminal's Refund modal (F-28, `#41`): order search, Refund All and per-item refunds (D-11). */
export function RefundButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setOpen(true);
        }}
      >
        <Undo2Icon /> Refund
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>Refund a bill</DialogTitle>
          </DialogHeader>
          {open && <OrdersPanel />}
        </DialogContent>
      </Dialog>
    </>
  );
}
