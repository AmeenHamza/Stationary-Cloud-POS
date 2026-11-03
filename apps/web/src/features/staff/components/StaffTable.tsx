'use client';

import { KeyRoundIcon, PencilIcon, PowerIcon } from 'lucide-react';

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

import { ROLE_LABEL, type StaffMember } from '../staff-user';

export interface StaffActions {
  onEdit: (member: StaffMember) => void;
  onResetPassword: (member: StaffMember) => void;
  onToggleStatus: (member: StaffMember) => void;
}

/** One page of staff accounts with row actions (F-31). */
export function StaffTable({
  members,
  actions,
}: {
  members: readonly StaffMember[];
  actions: StaffActions;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Username</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => {
          const active = member.status === 'ACTIVE';
          return (
            <TableRow key={member.id}>
              <TableCell className="font-medium">{member.fullName}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {member.username}
              </TableCell>
              <TableCell>
                <Badge variant={member.role === 'ADMIN' ? 'default' : 'outline'}>
                  {ROLE_LABEL[member.role]}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={active ? 'success' : 'muted'}>
                  {active ? 'Active' : 'Disabled'}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      actions.onEdit(member);
                    }}
                  >
                    <PencilIcon /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      actions.onResetPassword(member);
                    }}
                  >
                    <KeyRoundIcon /> Reset password
                  </Button>
                  <Button
                    variant={active ? 'outline' : 'secondary'}
                    size="sm"
                    className={active ? 'text-destructive hover:text-destructive' : ''}
                    onClick={() => {
                      actions.onToggleStatus(member);
                    }}
                  >
                    <PowerIcon /> {active ? 'Disable' : 'Enable'}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
