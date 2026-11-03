'use client';

import { ArrowLeftIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import type { ReactNode } from 'react';

/**
 * Terminal khata modal (F-28, FEATURES.md §3.8 `#39`–`#40`): the list first, then one party's khata
 * with a way back, without leaving the billing screen (cashiers have no admin pages, D-11).
 */
export function PartyModal({
  title,
  open,
  onOpenChange,
  list,
  khata,
}: {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  list: (openKhata: (id: string) => void) => ReactNode;
  khata: (id: string) => ReactNode;
}) {
  const [partyId, setPartyId] = useState<string | null>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setPartyId(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {partyId === null ? (
          list(setPartyId)
        ) : (
          <div className="grid gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="w-fit"
              onClick={() => {
                setPartyId(null);
              }}
            >
              <ArrowLeftIcon /> Back to list
            </Button>
            {khata(partyId)}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
