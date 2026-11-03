import type { UserRole } from './enums.js';

/** Every permission checked by the API (API.md §5). */
export const PERMISSIONS = [
  'catalog:read',
  'catalog:write',
  'inventory:restock',
  'inventory:adjust',
  'sales:create',
  'sales:discount',
  'orders:read',
  'orders:refund',
  'customers:read',
  'customers:write',
  'customers:archive',
  'vendors:read',
  'vendors:write',
  'vendors:archive',
  'dashboard:read',
  'staff:manage',
  'settings:read',
  'settings:write',
  'ai:use',
  'catalog:import',
  'catalog:export',
  'audit:read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Cashier permissions (D-11: refunds, khata, vendor khata and discounts are allowed). */
const CASHIER: readonly Permission[] = [
  'catalog:read',
  'sales:create',
  'sales:discount',
  'orders:read',
  'orders:refund',
  'customers:read',
  'customers:write',
  'vendors:read',
  'vendors:write',
  'settings:read',
];

/** The single role → permission map used by the API guards and the web `useCan()` hook. */
export const ROLE_PERMISSIONS: Readonly<Record<UserRole, readonly Permission[]>> = {
  ADMIN: PERMISSIONS,
  CASHIER,
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
