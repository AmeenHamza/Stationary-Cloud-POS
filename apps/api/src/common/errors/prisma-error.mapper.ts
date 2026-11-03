import { AppError } from './app-error';

interface PrismaLikeError {
  code?: unknown;
  meta?: unknown;
  message?: unknown;
}

function asPrismaError(error: unknown): PrismaLikeError | null {
  return typeof error === 'object' && error !== null ? error : null;
}

/**
 * True for PostgreSQL serialization failures (40001) and deadlocks (40P01), which the
 * UnitOfWork retries (DATABASE.md §6). Prisma reports them as P2034, or with the SQLSTATE in the
 * driver adapter's metadata.
 */
export function isRetryableTransactionError(error: unknown): boolean {
  const prismaError = asPrismaError(error);
  if (prismaError === null) {
    return false;
  }
  if (prismaError.code === 'P2034') {
    return true;
  }
  const text = `${String(prismaError.message)} ${JSON.stringify(prismaError.meta ?? null)}`;
  return /\b(40001|40P01)\b/.test(text);
}

/** True for unique-constraint violations (P2002), optionally on a specific constraint/field. */
export function isUniqueViolation(error: unknown, target?: string): boolean {
  const prismaError = asPrismaError(error);
  if (prismaError?.code !== 'P2002') {
    return false;
  }
  return target === undefined || JSON.stringify(prismaError.meta ?? null).includes(target);
}

/**
 * Safety net used by the GraphQL formatter: services translate expected Prisma errors
 * themselves; anything left unmapped becomes INTERNAL_SERVER_ERROR.
 */
export function mapPrismaError(error: unknown): AppError | null {
  const prismaError = asPrismaError(error);
  if (prismaError?.code === 'P2002') {
    return new AppError('CONFLICT', 'This record conflicts with an existing one.');
  }
  if (prismaError?.code === 'P2025') {
    return new AppError('NOT_FOUND', 'The record was not found.');
  }
  return null;
}
