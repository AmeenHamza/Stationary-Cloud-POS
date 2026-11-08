'use client';

import { useQuery } from '@apollo/client/react';
import { PlusIcon } from 'lucide-react';
import { useState } from 'react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { useCursorPages } from '@/hooks/useCursorPages';

import { StaffUsersDocument } from '../graphql/staff.documents';
import { useDeleteStaff } from '../hooks/useDeleteStaff';
import { useStaffStatusToggle } from '../hooks/useStaffStatusToggle';

import { StaffDialogs } from './StaffDialogs';
import { StaffFilters, type StatusFilter } from './StaffFilters';
import { StaffList } from './StaffList';

import type { StaffMember } from '../staff-user';

/** Staff management (F-31): server-side search, status filter and keyset pages of 50. */
export function StaffScreen() {
  const pages = useCursorPages();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [resetting, setResetting] = useState<StaffMember | null>(null);
  const toggle = useStaffStatusToggle();
  const deletion = useDeleteStaff();

  const filter = { ...(search === '' ? {} : { search }), ...(status === 'ALL' ? {} : { status }) };
  const { data, error } = useQuery(StaffUsersDocument, {
    variables: { after: pages.after, filter },
  });
  const connection = data?.staffUsers;
  const close = { creating: setCreating, editing: setEditing, resetting: setResetting };

  return (
    <>
      <PageHeader
        title="Staff"
        description="Accounts that can sign in to the counters."
        actions={
          <Button
            variant="brand"
            onClick={() => {
              setCreating(true);
            }}
          >
            <PlusIcon /> Add staff
          </Button>
        }
      />
      <StaffFilters
        status={status}
        onSearch={(value) => {
          setSearch(value);
          pages.reset();
        }}
        onStatusChange={(value) => {
          setStatus(value);
          pages.reset();
        }}
      />
      <StaffList
        connection={connection}
        error={error}
        pages={pages}
        actions={{
          onEdit: setEditing,
          onResetPassword: setResetting,
          onToggleStatus: toggle.ask,
          onDelete: deletion.ask,
        }}
      />
      <StaffDialogs
        creating={creating}
        editing={editing}
        resetting={resetting}
        close={(dialog) => {
          if (dialog === 'creating') close.creating(false);
          else close[dialog](null);
        }}
        toggle={toggle}
        deletion={deletion}
      />
    </>
  );
}
