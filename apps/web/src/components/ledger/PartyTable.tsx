'use client';

import { BookOpenIcon, Trash2Icon } from 'lucide-react';

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

import { BalanceText } from './BalanceText';

import type { BalanceLabels, PartySummary } from './khata-labels';

/** Customers or vendors with their balances and an "Open khata" action (FEATURES.md §3.9–3.10). */
export function PartyTable({
  parties,
  labels,
  detailHeading,
  onOpen,
  onDelete,
}: {
  parties: readonly PartySummary[];
  labels: BalanceLabels;
  /** Column for `detail` (e.g. "Products"); omitted when the kind has none. */
  detailHeading?: string;
  onOpen: (party: PartySummary) => void;
  /** Offered only to roles that may delete (D-28). */
  onDelete?: (party: PartySummary) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Phone</TableHead>
          {detailHeading !== undefined && <TableHead>{detailHeading}</TableHead>}
          <TableHead className="text-right">Balance</TableHead>
          <TableHead className="text-right">Khata</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {parties.map((party) => (
          <TableRow key={party.id} data-party-id={party.id}>
            <TableCell className="font-medium">
              {party.name}
              {party.archivedAt !== null && (
                <Badge variant="muted" className="ml-2">
                  Archived
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground">{party.phone ?? '—'}</TableCell>
            {detailHeading !== undefined && (
              <TableCell className="text-muted-foreground">{party.detail ?? '—'}</TableCell>
            )}
            <TableCell className="text-right">
              <BalanceText balance={party.balance} labels={labels} />
            </TableCell>
            <TableCell className="text-right whitespace-nowrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onOpen(party);
                }}
              >
                <BookOpenIcon /> Open khata
              </Button>
              {onDelete !== undefined && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-1 text-destructive hover:text-destructive"
                  aria-label={`Delete ${party.name}`}
                  onClick={() => {
                    onDelete(party);
                  }}
                >
                  <Trash2Icon />
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
