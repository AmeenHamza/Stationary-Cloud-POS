# Runbook: moving from the old system (cutover)

For the owner and the developer together. Plan: DEPLOYMENT.md §11. The old system is only **read** by the
migration and stays available, read-only, for 30 days.

> **Done 2026-11-10:** the owner stopped billing in the old system, and the data was migrated into production
> and validated (36/36 checks, `verify` valid). The rest of this page stays as the record and for a re-run.
>
> **Before that:** the old schema is mapped
> ([MAPPING.md](../../tools/legacy-migration/MAPPING.md)), the tool is built, and a rehearsal with the real
> old data into a local database passed every check
> ([VALIDATION.md](../../tools/legacy-migration/VALIDATION.md)). Until the final run, nobody enters
> products, customers or bills in the new system: the tool refuses to merge into a database that already has
> them. Commands and recovery: [tools/legacy-migration/README.md](../../tools/legacy-migration/README.md).

## 1. Before cutover

1. **Done 2026-11-10:** the old schema was read directly (Q27), the mapping written, and MIG-01 to MIG-05
   pass against a fixture built from it.
2. **Dry run** (`migrate dry-run`): reads the old database and changes nothing. It reports planned rows,
   duplicate barcodes (Q35), implausible values (Q19), totals, and the fingerprint `apply` needs.
3. The owner fixes data in the old app where the report shows a blocking finding, or accepts the default
   handling of the others.
4. **Rehearsal:** `apply` into a copy of the new database, validation must pass, then a look at the app on
   it. Done locally on 2026-11-10 (36 of 36 checks; bills, receipts, khatas and the dashboard checked through
   the API). A rehearsal on a Neon branch of production, with staff training, is still open.

## 2. Cutover (after closing time)

| Step | Who | Check |
|---|---|---|
| Stop billing on the old system; note the last bill number of each counter | Owner | — |
| Final dry run: `migrate dry-run` | Owner | No blocking finding; counts match the old app's screens |
| Create a Neon branch `pre-cutover-<date>` from production | Developer | Branch exists |
| `migrate apply --confirm <fingerprint>` into production | Owner or developer | Outcome starts with `MIGRATED`; every check PASS in `report.md` |
| `migrate verify` and `cli:verify-integrity` on production | Developer | Both pass |
| Create staff accounts; set up counters ([counter-pc-setup.md](counter-pc-setup.md)) | Owner | Each cashier signs in |
| Smoke test: sign in, scan, check a customer's khata balance against the old app, cancel before payment | Owner | All as expected |

## 3. The first business day (rollback window)

- If a blocking problem appears, counters go back to the old system. Bills made in the new system that day
  are re-entered there by hand, and the migration is redone later after clearing that day's data. The owner
  decides.
- Otherwise, after 30 days the old system can be retired. Keep its last database backup.
