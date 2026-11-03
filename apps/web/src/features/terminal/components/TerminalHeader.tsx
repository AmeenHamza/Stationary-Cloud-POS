'use client';

import { useQuery } from '@apollo/client/react';
import { CalendarDaysIcon, LayoutDashboardIcon } from 'lucide-react';
import Link from 'next/link';

import { formatBusinessDate } from '@pos/domain';

import { BrandMark } from '@/components/layout/BrandMark';
import { Button } from '@/components/ui/button';

import { ServerInfoDocument } from '../graphql/terminal.documents';

import { KhataButtons } from './KhataButtons';
import { RefundButton } from './RefundButton';

import type { ReactNode } from 'react';

/**
 * Billing terminal header (FEATURES.md terminal header): brand, business date, a way back to the admin
 * panel for admins, and the account menu passed in by the route.
 */
export function TerminalHeader({
  accountMenu,
  showAdminLink,
}: {
  accountMenu: ReactNode;
  showAdminLink: boolean;
}) {
  const { data } = useQuery(ServerInfoDocument);
  const businessDate = data?.serverInfo.businessDate;
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-sidebar px-4 py-3">
      <BrandMark subtitle="Billing terminal" />
      <div className="flex items-center gap-2">
        {businessDate !== undefined && (
          <span className="flex items-center gap-2 rounded-full border px-3 py-1 text-sm text-muted-foreground">
            <CalendarDaysIcon className="size-4" aria-hidden />
            {formatBusinessDate(businessDate)}
          </span>
        )}
        <KhataButtons />
        <RefundButton />
        {showAdminLink && (
          <Button variant="outline" size="sm" asChild>
            <Link href="/products" prefetch={false}>
              <LayoutDashboardIcon /> Admin panel
            </Link>
          </Button>
        )}
        {accountMenu}
      </div>
    </header>
  );
}
