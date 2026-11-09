import type { RunLog } from '../log.js';
import type pg from 'pg';

/** What one write step did: the checkpoint written to the run log. */
export interface StepResult {
  step: string;
  planned: number;
  inserted: number;
}

export interface WriteContext {
  client: pg.ClientBase;
  batchSize: number;
  /** The run's start: stands in for an old creation time that is missing, and dates stock movements. */
  runAt: Date;
  log: RunLog;
}

/** Records a finished step in the run log and returns it. */
export function checkpoint(
  context: WriteContext,
  step: string,
  counts: { planned: number; inserted: number },
): StepResult {
  const result = { step, planned: counts.planned, inserted: counts.inserted };
  context.log.info(`Wrote ${step}`, result);
  return result;
}

/** A column list written as one string: `'id name created_at'`. */
export const columns = (names: string): string[] => names.split(/\s+/).filter(Boolean);
