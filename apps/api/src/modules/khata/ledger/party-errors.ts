import { AppError } from '../../../common/errors/app-error';

import type { PartyKind } from './party-store';

/**
 * Maps a conditional write that matched no row (Prisma P2025) to the user-facing error (API.md §4):
 * `CONFLICT` for a stale version, `NOT_FOUND` when the party is missing or archived.
 */
export async function mapPartyErrors<T>(
  kind: PartyKind,
  missing: 'CONFLICT' | 'NOT_FOUND',
  work: () => Promise<T>,
): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if ((error as { code?: unknown }).code !== 'P2025') {
      throw error;
    }
    throw missing === 'CONFLICT'
      ? new AppError('CONFLICT', `Someone else changed this ${kind}. Reload and try again.`)
      : new AppError('NOT_FOUND', `This ${kind} does not exist or is archived.`);
  }
}
