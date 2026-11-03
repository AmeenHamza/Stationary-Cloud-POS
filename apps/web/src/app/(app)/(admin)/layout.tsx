'use client';

import { AdminShell } from '@/components/layout/AdminShell';
import { ConnectionBanner } from '@/components/layout/ConnectionBanner';
import { AccountMenu, RequireRole } from '@/features/auth';
import { useConnectionStatus } from '@/providers/realtime-context';

import { ADMIN_NAV } from './admin-nav';

import type { ReactNode } from 'react';

/**
 * Admin panel: sidebar shell with the connection banner, admins only (the API checks permissions on
 * every call anyway). A client component because the navigation passes icon components, which
 * cannot cross the server boundary.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const status = useConnectionStatus();
  return (
    <RequireRole role="ADMIN">
      <AdminShell
        nav={ADMIN_NAV}
        accountMenu={<AccountMenu />}
        banner={<ConnectionBanner status={status} />}
      >
        {children}
      </AdminShell>
    </RequireRole>
  );
}
