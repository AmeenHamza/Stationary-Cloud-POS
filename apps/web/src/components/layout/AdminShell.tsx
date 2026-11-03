'use client';

import { MenuIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/cn';

import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';

import { BrandMark } from './BrandMark';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Live count shown after the label, e.g. the low-stock badge. */
  badge?: ReactNode;
}

function NavLink({ item, active, compact = false }: { item: NavItem; active: boolean; compact?: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      prefetch={false} // load a section only when it is opened (NETWORK_OPTIMIZATION.md §5.2, ADR-042)
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all duration-150',
        active
          ? 'border-primary/35 bg-primary/10 text-foreground shadow-xs'
          : 'border-transparent text-muted-foreground hover:border-border hover:bg-accent/70 hover:text-foreground',
        compact && 'shrink-0 rounded-full px-3 py-2 text-xs',
      )}
    >
      <Icon
        className={cn('size-4 transition-transform duration-150 group-hover:-translate-y-px', compact && 'size-3.5')}
        aria-hidden
      />
      <span className="truncate">{item.label}</span>
      {item.badge !== undefined && <span className="ml-auto">{item.badge}</span>}
    </Link>
  );
}

function MobileNav({ nav, isActive }: { nav: readonly NavItem[]; isActive: (href: string) => boolean }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="icon" variant="outline" aria-label="Open navigation menu">
          <MenuIcon className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-88 p-4">
        <DialogHeader>
          <DialogTitle>Navigation</DialogTitle>
        </DialogHeader>
        <nav className="grid gap-1" aria-label="Main">
          {nav.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </nav>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Admin layout: elevated desktop sidebar plus responsive top bar and drawer navigation.
 */
export function AdminShell({
  nav,
  accountMenu,
  banner,
  children,
}: {
  nav: readonly NavItem[];
  accountMenu: ReactNode;
  banner?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isActive = (href: string): boolean => pathname === href || pathname.startsWith(`${href}/`);
  return (
    <div className="flex min-h-svh bg-background">
      <aside className="sticky top-0 hidden h-svh w-72 shrink-0 flex-col border-r bg-sidebar/95 px-4 py-5 backdrop-blur lg:flex">
        <BrandMark subtitle="Admin panel" className="px-2 py-3" />
        <nav className="mt-5 grid gap-1.5" aria-label="Main">
          {nav.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </nav>
        <div className="mt-auto border-t pt-3">{accountMenu}</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        {banner}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur lg:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <MobileNav nav={nav} isActive={isActive} />
            <nav className="flex min-w-0 gap-1 overflow-x-auto" aria-label="Quick links">
              {nav.slice(0, 5).map((item) => (
                <NavLink key={item.href} item={item} active={isActive(item.href)} compact />
              ))}
            </nav>
          </div>
          {accountMenu}
        </header>
        <main className="flex-1 p-4 sm:p-5 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
