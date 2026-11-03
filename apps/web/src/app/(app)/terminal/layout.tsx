'use client';

import { ConnectionBanner } from '@/components/layout/ConnectionBanner';
import { AccountMenu, useViewer } from '@/features/auth';
import { CartProvider, TerminalHeader } from '@/features/terminal';
import { useConnectionStatus } from '@/providers/realtime-context';

import type { ReactNode } from 'react';

/** Billing terminal shell for every role that can sell (cashiers and admins); the cart lives here. */
export default function TerminalLayout({ children }: { children: ReactNode }) {
  const viewer = useViewer();
  const status = useConnectionStatus();
  return (
    <div className="flex min-h-svh flex-col">
      <ConnectionBanner status={status} />
      <TerminalHeader accountMenu={<AccountMenu />} showAdminLink={viewer.role === 'ADMIN'} />
      <CartProvider>{children}</CartProvider>
    </div>
  );
}
