import type { ErrorCode } from '@pos/contracts';

/**
 * An expected failure with a contract error code (API.md §4). `details` are safe to show to the
 * client (e.g. `fieldErrors`, `quote`, `retryAfterSeconds`) and go into `extensions`.
 */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** HTTP status for REST responses carrying an error code. */
export function httpStatusFor(code: ErrorCode): number {
  switch (code) {
    case 'UNAUTHENTICATED':
      return 401;
    case 'FORBIDDEN':
      return 403;
    case 'NOT_FOUND':
      return 404;
    case 'RATE_LIMITED':
      return 429;
    case 'INTERNAL_SERVER_ERROR':
      return 500;
    case 'AI_UNAVAILABLE':
      return 503;
    case 'CONFLICT':
    case 'IDEMPOTENCY_KEY_REUSED':
    case 'PRICE_CHANGED':
    case 'QUOTE_MISMATCH':
    case 'REFUND_EXCEEDS_REMAINING':
    case 'BALANCE_NOT_ZERO':
    case 'LAST_ADMIN':
      return 409;
    default:
      return 400;
  }
}
