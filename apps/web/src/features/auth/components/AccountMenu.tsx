'use client';

import { useApolloClient, useMutation } from '@apollo/client/react';
import { KeyRoundIcon, LogOutIcon, MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/providers/ThemeProvider';

import { LogoutDocument } from '../graphql/auth.documents';
import { useViewer } from '../hooks/useViewer';
import { LOGIN_PATH } from '../routes';

import { ChangePasswordDialog } from './ChangePasswordDialog';

const ROLE_LABEL = { ADMIN: 'Admin', CASHIER: 'Cashier' } as const;

function initials(fullName: string): string {
  const letters = fullName.split(/\s+/).map((part) => part.charAt(0));
  return (letters.slice(0, 2).join('') || '?').toUpperCase();
}

/** The signed-in user's menu: theme (F-05), change password (F-03), sign out (F-01). */
export function AccountMenu({ compact = false }: { compact?: boolean }) {
  const viewer = useViewer();
  const router = useRouter();
  const client = useApolloClient();
  const { setChoice } = useTheme();
  const [logout] = useMutation(LogoutDocument);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const signOut = async (): Promise<void> => {
    try {
      await logout();
    } finally {
      // Even if the request failed, this browser forgets the session's data and leaves.
      await client.clearStore();
      router.replace(LOGIN_PATH);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-auto gap-3 px-2 py-1.5" aria-label="Account menu">
            <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-from to-brand-to text-xs font-semibold text-white">
              {initials(viewer.fullName)}
            </span>
            {!compact && (
              <span className="grid text-left leading-tight">
                <span className="truncate text-sm font-medium">{viewer.fullName}</span>
                <span className="text-xs text-muted-foreground">{ROLE_LABEL[viewer.role]}</span>
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>
            <span className="block font-medium">{viewer.fullName}</span>
            <span className="block text-xs text-muted-foreground">@{viewer.username}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              setPasswordOpen(true);
            }}
          >
            <KeyRoundIcon /> Change password
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              setChoice('light');
            }}
          >
            <SunIcon /> Light theme
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setChoice('dark');
            }}
          >
            <MoonIcon /> Dark theme
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setChoice('system');
            }}
          >
            <MonitorIcon /> Match device
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => void signOut()}>
            <LogOutIcon /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </>
  );
}
