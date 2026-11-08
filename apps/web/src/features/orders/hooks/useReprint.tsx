'use client';

import { useApolloClient } from '@apollo/client/react';
import { useState } from 'react';
import { toast } from 'sonner';

import { ReceiptPrint } from '@/components/receipt/ReceiptPrint';
import { userMessageOf } from '@/lib/errors/graphql-error';

import { OrderReceiptDocument } from '../graphql/orders.documents';

import type { ReceiptFieldsFragment as Receipt } from '@/graphql/__generated__/graphql';

/**
 * Reprint from order history or a customer's khata (SYSTEM_DESIGN.md §3.5, F-40): `orderReceipt`,
 * then the 80 mm print. Built from the stored bill, so it shows exactly what was charged.
 */
export function useReprint() {
  const client = useApolloClient();
  const [printing, setPrinting] = useState<{ receipt: Receipt; count: number } | null>(null);
  const reprint = async (orderId: string) => {
    try {
      const { data } = await client.query({ query: OrderReceiptDocument, variables: { orderId } });
      if (data !== undefined) {
        setPrinting((current) => ({
          receipt: data.orderReceipt,
          count: (current?.count ?? 0) + 1,
        }));
      }
    } catch (error) {
      toast.error(userMessageOf(error));
    }
  };
  const element =
    printing === null ? null : (
      <ReceiptPrint receipt={printing.receipt} printCount={printing.count} />
    );
  return { reprint, element };
}
