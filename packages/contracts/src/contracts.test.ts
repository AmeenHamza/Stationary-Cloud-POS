import { describe, expect, it } from 'vitest';

import {
  EVENT_TYPES,
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasPermission,
  isErrorCode,
  isEventType,
} from './index.js';

describe('pagination limits', () => {
  it('default and maximum page size are both 50 (mandatory)', () => {
    expect(PAGE_SIZE_DEFAULT).toBe(50);
    expect(PAGE_SIZE_MAX).toBe(50);
  });
});

describe('permissions (API.md §5, D-11)', () => {
  it('gives admins every permission', () => {
    expect(ROLE_PERMISSIONS.ADMIN).toEqual(PERMISSIONS);
  });

  it.each([
    'sales:create',
    'sales:discount',
    'orders:refund',
    'customers:write',
    'vendors:write',
  ] as const)('lets cashiers %s (D-11)', (permission) => {
    expect(hasPermission('CASHIER', permission)).toBe(true);
  });

  it.each([
    'catalog:write',
    'inventory:restock',
    'inventory:adjust',
    'dashboard:read',
    'staff:manage',
    'settings:write',
    'ai:use',
    'customers:archive',
    'audit:read',
  ] as const)('keeps %s admin-only', (permission) => {
    expect(hasPermission('CASHIER', permission)).toBe(false);
  });

  it('cashier permissions are a subset of the catalog without duplicates', () => {
    const cashier = ROLE_PERMISSIONS.CASHIER;
    expect(new Set(cashier).size).toBe(cashier.length);
    expect(cashier.every((p) => PERMISSIONS.includes(p))).toBe(true);
  });
});

describe('guards', () => {
  it('recognises error codes and event types', () => {
    expect(isErrorCode('PRICE_CHANGED')).toBe(true);
    expect(isErrorCode('NOPE')).toBe(false);
    expect(isEventType('stock.changed')).toBe(true);
    expect(isEventType('toString')).toBe(false);
    expect(EVENT_TYPES).toContain('order.created');
  });
});
