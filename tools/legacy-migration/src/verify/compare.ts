import {
  COUNT_KEYS,
  GROUP_KEYS,
  RECORD_KEYS,
  TOTAL_KEYS,
  type Facts,
  type GroupKey,
  type RecordFields,
} from './facts.js';

import type { LegacyEntity } from '../legacy/schema-map.js';

/** One validation check. A failed critical check means the run is not successful. */
export interface CheckResult {
  name: string;
  passed: boolean;
  critical: boolean;
  detail: string;
  /** The first offending items, for the report. */
  samples: string[];
}

const SAMPLES = 20;

/**
 * Payment rows are a side table the bill's own method and total override (MAPPING.md §5.6), so a
 * per-method difference is reported without failing the run; the totals are checked separately.
 */
const ADVISORY_GROUPS: ReadonlySet<GroupKey> = new Set([
  'billPaymentsByMethod',
  'vendorPaymentsByMethod',
]);

const same = (name: string, expected: string, actual: string): CheckResult => ({
  name,
  passed: expected === actual,
  critical: true,
  detail: expected === actual ? expected : `old ${expected}, new ${actual}`,
  samples: [],
});

function compareMaps(
  name: string,
  expected: Map<string, string>,
  actual: Map<string, string>,
  critical: boolean,
): CheckResult {
  const keys = [...new Set([...expected.keys(), ...actual.keys()])].sort();
  const samples = keys
    .filter((key) => expected.get(key) !== actual.get(key))
    .map((key) => `${key}: old ${expected.get(key) ?? 'none'}, new ${actual.get(key) ?? 'none'}`);
  return {
    name,
    passed: samples.length === 0,
    critical,
    detail: `${String(keys.length)} groups`,
    samples,
  };
}

/** Every old record must exist once in the new database with the same values; none may be extra. */
function compareRecords(
  name: string,
  expected: Map<string, RecordFields>,
  actual: Map<string, RecordFields>,
): CheckResult {
  const samples: string[] = [];
  let missing = 0;
  let different = 0;
  for (const [id, fields] of expected) {
    const found = actual.get(id);
    if (found === undefined) {
      missing += 1;
      samples.push(`#${id} missing`);
      continue;
    }
    const diffs = Object.entries(fields)
      .filter(([field, value]) => value !== null && found[field] !== value)
      .map(([field, value]) => `${field} old ${String(value)}, new ${found[field] ?? 'none'}`);
    if (diffs.length > 0) {
      different += 1;
      samples.push(`#${id}: ${diffs.join('; ')}`);
    }
  }
  const extra = [...actual.keys()].filter((id) => !expected.has(id));
  samples.push(...extra.map((id) => `#${id} not in the old data`));
  const passed = missing === 0 && different === 0 && extra.length === 0;
  const detail = `${String(expected.size)} old, ${String(actual.size)} new; missing ${String(missing)}, different ${String(different)}, extra ${String(extra.length)}`;
  return { name, passed, critical: true, detail, samples: samples.slice(0, SAMPLES) };
}

/** Old against new: counts, money totals, groups by month and method, and every record. */
export function compareFacts(source: Facts, target: Facts): CheckResult[] {
  return [
    ...COUNT_KEYS.map((key) =>
      same(`count: ${key}`, String(source.counts[key]), String(target.counts[key])),
    ),
    ...TOTAL_KEYS.map((key) => same(`total: ${key}`, source.totals[key], target.totals[key])),
    ...GROUP_KEYS.map((key) =>
      compareMaps(
        `by group: ${key}`,
        source.groups[key],
        target.groups[key],
        !ADVISORY_GROUPS.has(key),
      ),
    ),
    ...RECORD_KEYS.map((key) =>
      compareRecords(`records: ${key}`, source.records[key], target.records[key]),
    ),
  ];
}

/** The reader got every old row: rows read = rows counted in the same snapshot. */
export function rowsReadCheck(
  read: Readonly<Record<LegacyEntity, number>>,
  counted: Readonly<Record<LegacyEntity, number>>,
): CheckResult {
  const samples = (Object.keys(counted) as LegacyEntity[])
    .filter((entity) => read[entity] !== counted[entity])
    .map((entity) => `${entity}: read ${String(read[entity])} of ${String(counted[entity])}`);
  const total = Object.values(counted).reduce((sum, n) => sum + n, 0);
  return {
    name: 'old rows read',
    passed: samples.length === 0,
    critical: true,
    detail: `${String(total)} rows`,
    samples,
  };
}
