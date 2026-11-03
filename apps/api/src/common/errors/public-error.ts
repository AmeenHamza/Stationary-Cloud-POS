import { DomainRuleError } from '@pos/domain';

import { AppError } from './app-error';
import { mapPrismaError } from './prisma-error.mapper';

/**
 * Converts any thrown value into the error the client may see, or null when it is unexpected
 * (then only INTERNAL_SERVER_ERROR + requestId is returned and the details are logged).
 */
export function toPublicError(error: unknown): AppError | null {
  if (error instanceof AppError) {
    return error;
  }
  if (error instanceof DomainRuleError) {
    const details =
      error.field === undefined ? {} : { fieldErrors: { [error.field]: error.message } };
    return new AppError(error.code, error.message, details);
  }
  return mapPrismaError(error);
}
