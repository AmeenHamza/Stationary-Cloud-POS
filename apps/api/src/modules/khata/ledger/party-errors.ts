import { AppError } from '../../../common/errors/app-error';

import type { PartyKind } from './party-store';

/** D-28: bills and khata entries are kept, so a party they point at cannot be deleted. */
export function partyHasHistory(kind: PartyKind): AppError {
  const what = kind === 'customer' ? 'bills or khata entries' : 'khata entries';
  return new AppError(
    'HAS_HISTORY',
    `This ${kind} has ${what}, so it cannot be deleted. Archive it instead.`,
  );
}

/** A delete refused by a foreign key (P2003: an entry or bill landed after the check) is the same. */
export async function refuseIfReferenced(kind: PartyKind, work: () => Promise<void>) {
  try {
    await work();
  } catch (error) {
    throw (error as { code?: unknown }).code === 'P2003' ? partyHasHistory(kind) : error;
  }
}

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
