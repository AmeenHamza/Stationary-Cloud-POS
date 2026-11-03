import { registerEnumType } from '@nestjs/graphql';

import {
  ADJUSTMENT_DIRECTIONS,
  AI_CHAT_ROLES,
  AI_LANGUAGES,
  AI_REPORT_PERIODS,
  ADJUSTMENT_REASONS,
  CATEGORY_CHANGES,
  CUSTOMER_ENTRY_TYPES,
  DISCOUNT_TYPES,
  IMPORT_ROW_STATUSES,
  IMPORT_STATUSES,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PRODUCT_CHANGES,
  PRODUCT_SORTS,
  RANKING_DIRECTIONS,
  REFUND_SETTLEMENTS,
  REPORT_PERIODS,
  SALE_UNITS,
  USER_ROLES,
  USER_STATUSES,
  VENDOR_ENTRY_TYPES,
} from '@pos/contracts';

/** `{ A: 'A', B: 'B' }` from a contracts tuple, the shape `registerEnumType` needs. */
function enumObject<T extends string>(values: readonly T[]): Readonly<Record<T, T>> {
  return Object.fromEntries(values.map((value) => [value, value])) as Record<T, T>;
}

/**
 * GraphQL enums built from `@pos/contracts` (the single source of enum values; ARCH-02 checks the
 * database side). Import an enum from here when a type or input uses it.
 */
export const UserRoleEnum = enumObject(USER_ROLES);
registerEnumType(UserRoleEnum, { name: 'UserRole' });

export const UserStatusEnum = enumObject(USER_STATUSES);
registerEnumType(UserStatusEnum, { name: 'UserStatus' });

export const SaleUnitEnum = enumObject(SALE_UNITS);
registerEnumType(SaleUnitEnum, { name: 'SaleUnit' });

export const ProductSortEnum = enumObject(PRODUCT_SORTS);
registerEnumType(ProductSortEnum, { name: 'ProductSort' });

export const AdjustmentReasonEnum = enumObject(ADJUSTMENT_REASONS);
registerEnumType(AdjustmentReasonEnum, { name: 'AdjustmentReason' });

export const AdjustmentDirectionEnum = enumObject(ADJUSTMENT_DIRECTIONS);
registerEnumType(AdjustmentDirectionEnum, { name: 'AdjustmentDirection' });

export const ProductChangeEnum = enumObject(PRODUCT_CHANGES);
registerEnumType(ProductChangeEnum, { name: 'ProductChange' });

export const CategoryChangeEnum = enumObject(CATEGORY_CHANGES);
registerEnumType(CategoryChangeEnum, { name: 'CategoryChange' });

export const PaymentMethodEnum = enumObject(PAYMENT_METHODS);
registerEnumType(PaymentMethodEnum, { name: 'PaymentMethod' });

export const CustomerEntryTypeEnum = enumObject(CUSTOMER_ENTRY_TYPES);
registerEnumType(CustomerEntryTypeEnum, { name: 'CustomerEntryType' });

export const VendorEntryTypeEnum = enumObject(VENDOR_ENTRY_TYPES);
registerEnumType(VendorEntryTypeEnum, { name: 'VendorEntryType' });

export const DiscountTypeEnum = enumObject(DISCOUNT_TYPES);
registerEnumType(DiscountTypeEnum, { name: 'DiscountType' });

export const OrderStatusEnum = enumObject(ORDER_STATUSES);
registerEnumType(OrderStatusEnum, { name: 'OrderStatus' });

export const RefundSettlementEnum = enumObject(REFUND_SETTLEMENTS);
registerEnumType(RefundSettlementEnum, { name: 'RefundSettlement' });

export const ReportPeriodEnum = enumObject(REPORT_PERIODS);
registerEnumType(ReportPeriodEnum, { name: 'ReportPeriod' });

export const RankingDirectionEnum = enumObject(RANKING_DIRECTIONS);
registerEnumType(RankingDirectionEnum, { name: 'RankingDirection' });

export const ImportStatusEnum = enumObject(IMPORT_STATUSES);
registerEnumType(ImportStatusEnum, { name: 'ImportStatus' });

export const ImportRowStatusEnum = enumObject(IMPORT_ROW_STATUSES);
registerEnumType(ImportRowStatusEnum, { name: 'ImportRowStatus' });

export const AiLanguageEnum = enumObject(AI_LANGUAGES);
registerEnumType(AiLanguageEnum, { name: 'AiLanguage' });

export const AiReportPeriodEnum = enumObject(AI_REPORT_PERIODS);
registerEnumType(AiReportPeriodEnum, { name: 'AiReportPeriod' });

export const AiChatRoleEnum = enumObject(AI_CHAT_ROLES);
registerEnumType(AiChatRoleEnum, { name: 'AiChatRole' });
