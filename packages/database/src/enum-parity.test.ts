import { describe, expect, it } from 'vitest';

import * as contracts from '@pos/contracts';

import * as $Enums from './generated/prisma/enums.js';

/**
 * ARCH-02 (TESTING.md §10): every PostgreSQL enum equals its `@pos/contracts` value set, so the
 * API, the web app and the database can never disagree on a value.
 */
const PAIRS: [string, Record<string, string>, readonly string[]][] = [
  ['UserRole', $Enums.UserRole, contracts.USER_ROLES],
  ['UserStatus', $Enums.UserStatus, contracts.USER_STATUSES],
  ['SaleUnit', $Enums.SaleUnit, contracts.SALE_UNITS],
  ['StockMovementType', $Enums.StockMovementType, contracts.STOCK_MOVEMENT_TYPES],
  ['AdjustmentReason', $Enums.AdjustmentReason, contracts.ADJUSTMENT_REASONS],
  ['PaymentMethod', $Enums.PaymentMethod, contracts.PAYMENT_METHODS],
  ['CustomerEntryType', $Enums.CustomerEntryType, contracts.CUSTOMER_ENTRY_TYPES],
  ['VendorEntryType', $Enums.VendorEntryType, contracts.VENDOR_ENTRY_TYPES],
  ['DiscountType', $Enums.DiscountType, contracts.DISCOUNT_TYPES],
  ['OrderStatus', $Enums.OrderStatus, contracts.ORDER_STATUSES],
  ['RefundSettlement', $Enums.RefundSettlement, contracts.REFUND_SETTLEMENTS],
  ['ImportKind', $Enums.ImportKind, contracts.IMPORT_KINDS],
  ['ImportStatus', $Enums.ImportStatus, contracts.IMPORT_STATUSES],
  ['ImportRowStatus', $Enums.ImportRowStatus, contracts.IMPORT_ROW_STATUSES],
];

describe('enum parity (ARCH-02)', () => {
  it.each(PAIRS)('%s matches @pos/contracts', (_name, prismaEnum, contractValues) => {
    expect(Object.values(prismaEnum).sort()).toEqual([...contractValues].sort());
  });
});
