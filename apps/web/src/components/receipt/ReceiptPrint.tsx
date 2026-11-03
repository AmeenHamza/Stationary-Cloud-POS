'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

import { ReceiptBody } from './ReceiptBody';

import type { ReceiptFieldsFragment as Receipt } from '@/graphql/__generated__/graphql';

const noSubscribe = (): (() => void) => () => undefined;

/**
 * Prints a receipt (SYSTEM_DESIGN.md §3.5): the body goes into a print-only portal styled by
 * `styles/print-receipt.css`, then, once fonts are ready, the browser prints. Each new `printCount`
 * prints again (reprint). Counter PCs print silently with Chrome `--kiosk-printing`.
 */
export function ReceiptPrint({ receipt, printCount }: { receipt: Receipt; printCount: number }) {
  const mounted = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  useEffect(() => {
    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (!cancelled) {
        window.print();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [receipt.billNumber, printCount]);
  return mounted
    ? createPortal(
        <div className="receipt-print" aria-hidden>
          <ReceiptBody receipt={receipt} />
        </div>,
        document.body,
      )
    : null;
}
