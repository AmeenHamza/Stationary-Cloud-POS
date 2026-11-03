'use client';

import { formatRs } from '@pos/domain';

import { QuantityStepper } from '@/components/forms/QuantityStepper';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { OrderDetailQuery } from '@/graphql/__generated__/graphql';

type Line = NonNullable<OrderDetailQuery['order']>['lines'][number];

/** Per line: Sold, Refunded, Remaining and the Refund Qty stepper (FEATURES.md §3.7 `#17`). */
export function RefundLinesTable({
  lines,
  quantities,
  onQuantity,
}: {
  lines: readonly Line[];
  quantities: Readonly<Record<string, number>>;
  onQuantity: (lineId: string, quantity: number) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead className="text-right">Sold</TableHead>
          <TableHead className="text-right">Refunded</TableHead>
          <TableHead className="text-right">Remaining</TableHead>
          <TableHead>Refund qty</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((line) => {
          const remaining = line.quantity - line.refundedQuantity;
          const unit = line.saleUnit === 'BOX' ? 'box' : 'pc';
          return (
            <TableRow key={line.id}>
              <TableCell>
                <div className="font-medium">{line.productName}</div>
                <div className="text-xs text-muted-foreground">
                  {formatRs(line.unitPrice)} / {unit}
                </div>
              </TableCell>
              <TableCell className="text-right">{line.quantity}</TableCell>
              <TableCell className="text-right">{line.refundedQuantity}</TableCell>
              <TableCell className="text-right">{remaining}</TableCell>
              <TableCell>
                {remaining > 0 ? (
                  <QuantityStepper
                    label={line.productName}
                    quantity={quantities[line.id] ?? 0}
                    min={0}
                    max={remaining}
                    onChange={(quantity) => {
                      onQuantity(line.id, quantity);
                    }}
                  />
                ) : (
                  <span className="text-muted-foreground">Fully refunded</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
