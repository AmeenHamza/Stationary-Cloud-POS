'use client';

import { useMutation, useQuery } from '@apollo/client/react';
import { CheckIcon, PlusIcon, SearchIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { BalanceText } from '@/components/ledger/BalanceText';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { userMessageOf } from '@/lib/errors/graphql-error';

import { CUSTOMER_BALANCE_LABELS } from '../customer-labels';
import { CreateCustomerDocument, CustomersDocument } from '../graphql/customers.documents';

import type { CustomerFieldsFragment } from '@/graphql/__generated__/graphql';

export interface PickedCustomer {
  id: string;
  name: string;
}

/** Search results as buttons; the picked customer is marked. */
function CustomerOptions({
  customers,
  selectedId,
  onPick,
}: {
  customers: readonly CustomerFieldsFragment[];
  selectedId: string | null;
  onPick: (customer: PickedCustomer) => void;
}) {
  return (
    <ul className="grid max-h-48 gap-1 overflow-y-auto" aria-label="Customers">
      {customers.map((customer) => (
        <li key={customer.id}>
          <button
            type="button"
            className={cn(
              'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent',
              selectedId === customer.id && 'bg-primary/10',
            )}
            onClick={() => {
              onPick({ id: customer.id, name: customer.name });
            }}
          >
            <span className="flex items-center gap-2">
              {selectedId === customer.id && <CheckIcon className="size-4" aria-hidden />}
              {customer.name}
              {customer.phone !== null && (
                <span className="text-muted-foreground">{customer.phone}</span>
              )}
            </span>
            <BalanceText balance={customer.balance} labels={CUSTOMER_BALANCE_LABELS} />
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Udhaar customer choice (D-15, SYSTEM_DESIGN.md §3.7): server search, 50 per page, and quick-add
 * when the customer is new. The whole bill goes to the chosen customer's khata.
 */
export function UdhaarCustomerPicker({
  value,
  onChange,
}: {
  value: PickedCustomer | null;
  onChange: (customer: PickedCustomer) => void;
}) {
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const { data, error } = useQuery(CustomersDocument, {
    variables: { filter: search === '' ? {} : { search } },
  });
  const [create, { loading: adding }] = useMutation(CreateCustomerDocument);
  const quickAdd = async () => {
    try {
      const result = await create({ variables: { input: { name: text.trim() } } });
      const created = result.data?.createCustomer;
      if (created !== undefined) {
        onChange({ id: created.id, name: created.name });
        toast.success(`${created.name} added.`);
      }
    } catch (failure) {
      toast.error(userMessageOf(failure));
    }
  };
  return (
    <div className="grid gap-2 rounded-lg border p-3">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(text.trim());
        }}
      >
        <Input
          placeholder="Customer name or phone"
          aria-label="Search customers"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
          }}
        />
        <Button type="submit" variant="outline" aria-label="Find customer">
          <SearchIcon />
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={text.trim() === '' || adding}
          onClick={() => void quickAdd()}
        >
          <PlusIcon /> Add
        </Button>
      </form>
      {error !== undefined && <p className="text-sm text-destructive">{userMessageOf(error)}</p>}
      <CustomerOptions
        customers={data?.customers.nodes ?? []}
        selectedId={value?.id ?? null}
        onPick={onChange}
      />
    </div>
  );
}
