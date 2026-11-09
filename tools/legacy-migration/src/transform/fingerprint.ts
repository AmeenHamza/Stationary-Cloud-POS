import { createHash } from 'node:crypto';

import type { MigrationPlan } from './plan.js';

/**
 * A short digest of everything a run would write. The dry run prints it, and `apply` refuses unless it
 * is given the same value: the owner confirms exactly the data they reviewed, and a change in the old
 * database since the dry run (a new bill, an edited product) stops the real run (MAPPING.md §11).
 */
export function fingerprintOf(plan: MigrationPlan): string {
  const json = JSON.stringify(plan, (_key, value: unknown) =>
    value instanceof Map ? [...value] : value,
  );
  return createHash('sha256').update(json).digest('hex').slice(0, 12);
}
