## Feature

FEATURES.md ids (`F-xx`) and rules (`BR-xx`, `D-xx`):

## Checklist (CODING_STANDARDS.md §9)

- [ ] Affected docs updated in this PR (API, DATABASE, SYSTEM_DESIGN, DECISIONS, FEATURES status)
- [ ] No new polling, timers or periodic refetch
- [ ] Every new list is backend-paginated (`first` ≤ 50) and indexed
- [ ] Every Prisma call has `select` (writes) / `take` (findMany)
- [ ] Events are small (≤ 1 KB), scoped and contain no PII
- [ ] Redis use justified, keys registered, degraded mode defined
- [ ] Money only via `@pos/domain`; server recomputes totals
- [ ] Every resolver declares a permission
- [ ] No PII or secrets in logs, tests or fixtures
- [ ] Tests added: unit / integration / concurrency / realtime / e2e as applicable
- [ ] `pnpm verify` passes locally
