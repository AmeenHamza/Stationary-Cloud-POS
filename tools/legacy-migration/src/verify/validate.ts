import { compareFacts, rowsReadCheck, type CheckResult } from './compare.js';
import { integrityChecks } from './integrity.js';
import { sourceFacts } from './source-facts.js';
import { targetFacts } from './target-facts.js';

import type { OldSide } from '../commands/old-side.js';
import type pg from 'pg';

/**
 * The full validation (VALIDATION.md): every old row was read, old and new agree on counts, money,
 * groups and every record, and the application's integrity checks pass. Reads only; inside `apply`
 * it runs before COMMIT, so a failure means nothing is written.
 */
export async function validate(
  target: pg.ClientBase,
  old: OldSide,
  timeZone: string,
): Promise<CheckResult[]> {
  const expected = sourceFacts(old.data, timeZone);
  const actual = await targetFacts(target, timeZone);
  return [
    rowsReadCheck(old.plan.read, old.counted),
    ...compareFacts(expected, actual),
    ...(await integrityChecks(target)),
  ];
}
