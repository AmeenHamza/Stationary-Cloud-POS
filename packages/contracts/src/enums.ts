/**
 * Shared value sets. They equal the PostgreSQL enums (DATABASE.md §3) and the GraphQL enums
 * (API.md §2); a parity test guards the Prisma side.
 */
export const USER_ROLES = ['ADMIN', 'CASHIER'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ['ACTIVE', 'DISABLED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const SALE_UNITS = ['PIECE', 'BOX'] as const;
export type SaleUnit = (typeof SALE_UNITS)[number];

export const PAYMENT_METHODS = [
  'CASH',
  'CARD',
  'EASYPAISA',
  'JAZZCASH',
  'BANK_TRANSFER',
  'UDHAAR',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const DISCOUNT_TYPES = ['NONE', 'FLAT', 'PERCENT'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const ORDER_STATUSES = ['COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const REFUND_SETTLEMENTS = ['ORIGINAL_METHOD', 'KHATA_CREDIT'] as const;
export type RefundSettlement = (typeof REFUND_SETTLEMENTS)[number];

export const STOCK_MOVEMENT_TYPES = [
  'OPENING',
  'SALE',
  'REFUND',
  'RESTOCK',
  'ADJUSTMENT_INCREASE',
  'ADJUSTMENT_DECREASE',
  'MIGRATION',
] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export const ADJUSTMENT_REASONS = ['DAMAGED', 'LOST', 'COUNT_CORRECTION', 'OTHER'] as const;
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];

/** `adjustStock` direction (D-18); maps to ADJUSTMENT_INCREASE / ADJUSTMENT_DECREASE movements. */
export const ADJUSTMENT_DIRECTIONS = ['INCREASE', 'DECREASE'] as const;
export type AdjustmentDirection = (typeof ADJUSTMENT_DIRECTIONS)[number];

/** `change` field of `product.changed` and `category.changed` events (API.md §7.2). */
export const PRODUCT_CHANGES = ['CREATED', 'UPDATED', 'ARCHIVED', 'RESTORED'] as const;
export type ProductChange = (typeof PRODUCT_CHANGES)[number];

export const CATEGORY_CHANGES = ['CREATED', 'UPDATED', 'DELETED'] as const;
export type CategoryChange = (typeof CATEGORY_CHANGES)[number];

export const CUSTOMER_ENTRY_TYPES = [
  'OPENING_BALANCE',
  'CREDIT_SALE',
  'MANUAL_CREDIT',
  'PAYMENT',
  'REFUND_CREDIT',
] as const;
export type CustomerEntryType = (typeof CUSTOMER_ENTRY_TYPES)[number];

export const VENDOR_ENTRY_TYPES = ['OPENING_BALANCE', 'PURCHASE', 'PAYMENT'] as const;
export type VendorEntryType = (typeof VENDOR_ENTRY_TYPES)[number];

export const IMPORT_KINDS = ['PRODUCTS'] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];

export const IMPORT_STATUSES = ['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED'] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

export const IMPORT_ROW_STATUSES = ['PENDING', 'SUCCEEDED', 'FAILED', 'SKIPPED'] as const;
export type ImportRowStatus = (typeof IMPORT_ROW_STATUSES)[number];

export const AI_LANGUAGES = ['ENGLISH', 'URDU', 'ROMAN_URDU'] as const;
export type AiLanguage = (typeof AI_LANGUAGES)[number];

export const PRODUCT_SORTS = ['NAME_ASC', 'NAME_DESC', 'PRICE_ASC', 'PRICE_DESC'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

/** Dashboard periods (API.md §6.3); weeks start on Monday (Q18). */
export const REPORT_PERIODS = ['TODAY', 'THIS_WEEK', 'THIS_MONTH'] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

export const RANKING_DIRECTIONS = ['HIGHEST', 'LOWEST'] as const;
export type RankingDirection = (typeof RANKING_DIRECTIONS)[number];

/** File formats of the product export (API.md §9); the low-stock export offers CSV and PDF. */
export const EXPORT_FORMATS = ['csv', 'xlsx', 'pdf'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/** AI Assistant features (D-22, API.md §6.2); `ASK` is the "Ask Your POS" chat. */
export const AI_FEATURES = [
  'SALES_INSIGHTS',
  'INVENTORY_FORECAST',
  'PURCHASE_RECOMMENDATIONS',
  'ASK',
  'BUSINESS_REPORT',
  'DISCOUNT_ADVICE',
] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

/** Business report periods: today, the last 7 or 30 days, or a custom range (F-29). */
export const AI_REPORT_PERIODS = ['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'] as const;
export type AiReportPeriod = (typeof AI_REPORT_PERIODS)[number];

export const AI_CHAT_ROLES = ['USER', 'ASSISTANT'] as const;
export type AiChatRole = (typeof AI_CHAT_ROLES)[number];
