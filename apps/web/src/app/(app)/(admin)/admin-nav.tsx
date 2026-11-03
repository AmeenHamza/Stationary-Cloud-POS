import {
  BookUserIcon,
  LayoutDashboardIcon,
  PackageIcon,
  ReceiptTextIcon,
  SettingsIcon,
  ShoppingCartIcon,
  SparklesIcon,
  TagsIcon,
  TruckIcon,
  TriangleAlertIcon,
  UsersIcon,
} from 'lucide-react';

import { LowStockBadge } from '@/features/catalog';

import type { NavItem } from '@/components/layout/AdminShell';

/** Admin sidebar. Sections are added as their features ship (IMPLEMENTATION_PLAN.md §3). */
export const ADMIN_NAV: readonly NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboardIcon },
  { href: '/products', label: 'Products', icon: PackageIcon },
  { href: '/categories', label: 'Categories', icon: TagsIcon },
  { href: '/low-stock', label: 'Low stock', icon: TriangleAlertIcon, badge: <LowStockBadge /> },
  { href: '/orders', label: 'Orders', icon: ReceiptTextIcon },
  { href: '/customers', label: 'Customers', icon: BookUserIcon },
  { href: '/vendors', label: 'Vendors', icon: TruckIcon },
  { href: '/ai', label: 'AI Assistant', icon: SparklesIcon },
  { href: '/staff', label: 'Staff', icon: UsersIcon },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
  { href: '/terminal', label: 'Billing terminal', icon: ShoppingCartIcon },
];
