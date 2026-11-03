import { createSaleInputSchema } from '@pos/validation';

import { safeLocalStorage } from '@/lib/storage/safe-local-storage';

import type { CreateSaleInput } from '@/graphql/__generated__/graphql';

const pendingKey = (userId: string): string => `pos:pending-sale:${userId}`;

/**
 * The sale being sent, kept until the server confirms or refuses it (SYSTEM_DESIGN.md §3.4), so a
 * reload can ask `saleStatus` for its key instead of guessing. It is a draft, never a record.
 */
export function savePendingSale(userId: string, input: CreateSaleInput): void {
  safeLocalStorage.set(pendingKey(userId), JSON.stringify(input));
}

/** The pending sale, if a well-formed one was saved (checked with the API's own schema). */
export function loadPendingSale(userId: string): CreateSaleInput | null {
  const raw = safeLocalStorage.get(pendingKey(userId));
  if (raw === null) {
    return null;
  }
  try {
    const parsed = createSaleInputSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function clearPendingSale(userId: string): void {
  safeLocalStorage.remove(pendingKey(userId));
}
