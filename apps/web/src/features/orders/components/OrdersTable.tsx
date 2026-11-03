'use client';

import { PrinterIcon, Undo2Icon } from 'lucide-react';

import { DEFAULT_BUSINESS_TIMEZONE } from '@pos/contracts';
import { formatDateTime, formatRs } from '@pos/domain';

import { PAYMENT_METHOD_LABEL } from '@/components/ledger/khata-labels';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { discountLabel, ORDER_STATUS_LABEL } from '../order-labels';

import type { OrderRowFieldsFragment as Order } from '@/graphql/__generated__/graphql';

const HEADINGS = ['Order #', 'Date & time', 'Subtotal', 'Discount', 'GST', 'Total', 'Method'];

/** Order history rows (FEATURES.md §3.7): FBR is dropped (D-03); refund and reprint per bill. */
export function OrdersTable({
  orders,
  onRefund,
  onReprint,
}: {
  orders: readonly Order[];
  onRefund: (orderId: string) => void;
  onReprint: (orderId: string) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {HEADINGS.map((heading) => (
            <TableHead key={heading}>{heading}</TableHead>
          ))}
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.id}>
            <TableCell className="font-medium">{order.billNumber}</TableCell>
            <TableCell>
              {formatDateTime(new Date(order.createdAt), DEFAULT_BUSINESS_TIMEZONE)}
            </TableCell>
            <TableCell>{formatRs(order.subtotal)}</TableCell>
            <TableCell>{discountLabel(order)}</TableCell>
            <TableCell>{formatRs(order.billGstAmount)}</TableCell>
            <TableCell className="font-semibold">{formatRs(order.total)}</TableCell>
            <TableCell>{PAYMENT_METHOD_LABEL[order.paymentMethod]}</TableCell>
            <TableCell>
              <Badge variant={order.status === 'COMPLETED' ? 'success' : 'muted'}>
                {ORDER_STATUS_LABEL[order.status]}
              </Badge>
            </TableCell>
            <TableCell className="text-right whitespace-nowrap">
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Reprint ${order.billNumber}`}
                onClick={() => {
                  onReprint(order.id);
                }}
              >
                <PrinterIcon />
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={order.status === 'REFUNDED'}
                aria-label={`Refund ${order.billNumber}`}
                onClick={() => {
                  onRefund(order.id);
                }}
              >
                <Undo2Icon /> Refund
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
