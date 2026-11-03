# Runbook: moving from the old system (cutover)

For the owner and the developer together. Plan: DEPLOYMENT.md §11. The old system is only **read** by the
migration and stays available, read-only, for 30 days.

> **Blocked until the owner shares the old database schema (Q27).** The migration tool
> (`tools/legacy-migration`) handles everything on the new side; it needs the old table and column names
> to read the old data. Sections 1 and 2 cannot start before that.

## 1. Before cutover (weeks ahead)

1. The owner runs these two read-only queries in the old project's Neon SQL editor and shares both results
   (Q27). They list table names, column names and keys only; no shop data is read.

   ```sql
   SELECT table_name, column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_schema = 'public'
   ORDER BY table_name, ordinal_position;

   SELECT tc.table_name, tc.constraint_type, kcu.column_name, ccu.table_name AS references_table
   FROM information_schema.table_constraints tc
   JOIN information_schema.key_column_usage kcu
     ON kcu.constraint_schema = tc.constraint_schema AND kcu.constraint_name = tc.constraint_name
   LEFT JOIN information_schema.constraint_column_usage ccu
     ON ccu.constraint_schema = tc.constraint_schema AND ccu.constraint_name = tc.constraint_name
     AND tc.constraint_type = 'FOREIGN KEY'
   WHERE tc.table_schema = 'public' AND tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE')
   ORDER BY tc.table_name, tc.constraint_type, kcu.column_name;
   ```
2. The developer writes the old-to-new mapping (`tools/legacy-migration/src/legacy/schema-map.ts`) and runs
   the tests against a fixture built from that schema (MIG-01 to MIG-05).
3. The owner runs a **dry run** on their own machine with a read-only connection to the old database (the
   developer supplies the exact command with the tool). It changes nothing. It reports counts, duplicate barcodes (Q35), implausible values (Q19) and totals.
4. The owner fixes data in the old app where the report says so, or accepts the default handling.
5. **Rehearsal on staging:** a full migration into staging, `cli:verify-integrity` must pass, then staff
   training on staging. The owner signs off the rehearsal.

## 2. Cutover (after closing time)

| Step | Who | Check |
|---|---|---|
| Stop billing on the old system; note the last bill number of each counter | Owner | — |
| Final dry run | Owner | Counts match the old app's screens |
| Create a Neon branch `pre-cutover-<date>` from production | Developer | Branch exists |
| Real migration into production | Developer | Verification report matches exactly (counts, stock, khata balances, bill totals) |
| `cli:verify-integrity` on production | Developer | Every line `PASS` |
| Create staff accounts; set up counters ([counter-pc-setup.md](counter-pc-setup.md)) | Owner | Each cashier signs in |
| Smoke test: sign in, scan, check a customer's khata balance against the old app, cancel before payment | Owner | All as expected |

## 3. The first business day (rollback window)

- If a blocking problem appears, counters go back to the old system. Bills made in the new system that day
  are re-entered there by hand, and the migration is redone later after clearing that day's data. The owner
  decides.
- Otherwise, after 30 days the old system can be retired. Keep its last database backup.
