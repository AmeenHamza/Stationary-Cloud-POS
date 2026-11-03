import { capped, legacyUuid } from './values.js';

import type { Issues } from './issues.js';
import type { LegacyRow } from '../legacy/schema-map.js';

export interface CategoryPlan {
  id: string;
  legacyId: string;
  name: string;
  description: string | null;
}

/** Categories; names are unique ignoring case (citext), so later duplicates merge into the first. */
export function planCategories(
  rows: readonly LegacyRow<'categories'>[],
  issues: Issues,
): { categories: CategoryPlan[]; idOf: Map<string, string> } {
  const categories: CategoryPlan[] = [];
  const idOf = new Map<string, string>();
  const byName = new Map<string, CategoryPlan>();
  for (const row of rows) {
    const legacyId = row.id ?? '';
    const ref = `categories#${legacyId}`;
    const name = capped(row.name, 80, issues, ref, 'name') ?? `Category ${legacyId}`;
    const kept = byName.get(name.toLowerCase());
    if (kept !== undefined) {
      issues.note('category-merged', ref, `same name as categories#${kept.legacyId}; merged`);
      idOf.set(legacyId, kept.id);
      continue;
    }
    const plan = {
      id: legacyUuid('category', legacyId),
      legacyId,
      name,
      description: capped(row.description, 200, issues, ref, 'description'),
    };
    categories.push(plan);
    byName.set(name.toLowerCase(), plan);
    idOf.set(legacyId, plan.id);
  }
  return { categories, idOf };
}
