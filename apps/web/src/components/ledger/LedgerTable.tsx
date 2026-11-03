import { formatBusinessDate, formatRs } from '@pos/domain';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/cn';

import { PAYMENT_METHOD_LABEL, type LedgerEntry } from './khata-labels';

/** What an entry is about: the linked document, the method, the note. */
function describe(entry: LedgerEntry): string {
  const parts = [
    entry.reference ?? null,
    entry.paymentMethod === null ? null : PAYMENT_METHOD_LABEL[entry.paymentMethod],
    entry.note,
  ];
  return parts.filter((part) => part !== null && part !== '').join(' · ') || '—';
}

/** Khata rows, newest first, with the running balance (FEATURES.md §3.9 `#20`). */
export function LedgerTable({
  entries,
  typeLabels,
  balanceHeading,
}: {
  entries: readonly LedgerEntry[];
  typeLabels: Readonly<Record<string, string>>;
  balanceHeading: string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="text-right">{balanceHeading}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => {
          const raises = !entry.amount.startsWith('-');
          return (
            <TableRow key={entry.id} data-entry-type={entry.type}>
              <TableCell className="whitespace-nowrap">
                {formatBusinessDate(entry.businessDate)}
              </TableCell>
              <TableCell>{typeLabels[entry.type] ?? entry.type}</TableCell>
              <TableCell className="text-muted-foreground">{describe(entry)}</TableCell>
              <TableCell
                className={cn(
                  'text-right tabular-nums',
                  raises ? 'text-destructive' : 'text-success',
                )}
              >
                {raises ? '+' : ''}
                {formatRs(entry.amount)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatRs(entry.balanceAfter)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
