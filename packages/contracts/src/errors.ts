/** Every error code the API can return in `extensions.code` (API.md §4). */
export const ERROR_CODES = [
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'BAD_USER_INPUT',
  'NOT_FOUND',
  'CONFLICT',
  'IDEMPOTENCY_KEY_REUSED',
  'PRICE_CHANGED',
  'QUOTE_MISMATCH',
  'REFUND_EXCEEDS_REMAINING',
  'CUSTOMER_REQUIRED',
  'BALANCE_NOT_ZERO',
  'LAST_ADMIN',
  'RATE_LIMITED',
  'BAD_CURSOR',
  'AI_NOT_CONFIGURED',
  'AI_UNAVAILABLE',
  'INTERNAL_SERVER_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value);
}
