# Legacy migration: old POS → new POS

Moves the old system's data into the new system (F-36). It reads the old database and never changes it.
It writes the new database in **one transaction** that is validated before it is committed: after a run, the
new database is either completely migrated and checked, or unchanged.

| Document | What it covers |
|---|---|
| [MAPPING.md](MAPPING.md) | Old and new schemas, how every table and column maps, what is not migrated, data findings |
| [VALIDATION.md](VALIDATION.md) | Every check, what makes a run fail, and the latest results |
| [docs/runbooks/cutover.md](../../docs/runbooks/cutover.md) | The cutover day, step by step |
| [DECISIONS.md ADR-048](../../DECISIONS.md) | Why it works this way |

## 1. Setup (once)

1. **Node and packages:** Node 24 and `pnpm install` in the repository, as for the rest of the project.
2. **Schema on the new database:** it must have every migration, so run
   `pnpm --filter @pos/database migrate:deploy` against it once (the dry run checks this).
3. **Connection strings:** copy `.env.example` to `.env` in this folder and fill in:
   - `LEGACY_DATABASE_URL`: the old Neon project. Best a read-only role; the tool also opens it read-only.
   - `TARGET_DATABASE_URL`: the new Neon project, **direct** endpoint (the host without `-pooler`).

   `.env` and the `output/` folder are git-ignored. Never commit, log or paste these strings.
4. **Keep the new database empty** until the real run. The tool refuses a database that has products,
   customers, bills or khata entries it did not write itself.

## 2. Commands

Run from the repository root. Each run creates a folder under `tools/legacy-migration/output/` (see §4).

| Command | Writes to | What it does |
|---|---|---|
| `pnpm --filter @pos/legacy-migration migrate check` | nothing | Compares the old database's tables and columns with the map |
| `pnpm --filter @pos/legacy-migration migrate dry-run` | nothing | Reads the old data, plans every row, checks the new database, prints the **fingerprint** |
| `pnpm --filter @pos/legacy-migration migrate apply --confirm <fingerprint>` | new database | Migrates exactly the data the dry run showed, validates, then commits |
| `pnpm --filter @pos/legacy-migration migrate verify` | nothing | Compares the old and new databases again |

Options: `--batch-size <n>` (rows per read and per INSERT, default 500) and `--out <folder>`.
The exit code is 0 on success. Anything else means: read `report.md` in the run folder.

## 3. Running it

1. **Dry run:** `migrate dry-run`. Read `report.md`: the planned rows per table and every finding. Nothing is
   written anywhere. "Blocking" findings must be fixed in the old app first; the others are handled as
   MAPPING.md says. The last line gives the exact `apply` command with the fingerprint.
2. **Rehearse** (recommended): run `apply` into a **copy** of the new database (a Neon branch, or a local
   database with the migrations applied), then try the app on it. Delete the copy afterwards: it holds
   customer data.
3. **Stop billing in the old system.** Every new bill or khata entry there changes the fingerprint.
4. **Final dry run** against the real new database. Check the counts against the old app's screens.
5. **Apply:** `migrate apply --confirm <fingerprint from step 4>`. It takes seconds for today's data.
6. **Check:** the outcome must start with `MIGRATED`. Then:
   - reload the browser on every counter;
   - the category list can take up to 10 minutes to appear (API cache), or add a category to show it now;
   - create the staff accounts (old logins are not migrated, A-07) and enter the Groq key in Settings;
   - keep the old database and its last backup: it still holds the FBR numbers and loyalty points.
7. **Change both database passwords** if they were ever shared.

## 4. What a run leaves behind

| File | Contents |
|---|---|
| `report.md` | Outcome, planned rows, rows read, new-database check, rows written, validation table, findings (50 per kind) |
| `issues.csv` | Every finding: kind, blocking or not, old record, detail |
| `id-map.csv` | Old id → new id for categories, products, customers, vendors, bills and refunds |
| `run.jsonl` | The run log: one JSON line per step, the run's checkpoint and audit trail |

These files describe shop data: keep them on the machine that ran the migration.

## 5. Recovery

| What happened | What it means | What to do |
|---|---|---|
| `REFUSED: apply needs --confirm` | Nothing ran | Run the dry run and use its fingerprint |
| `REFUSED: the old data is not what the confirmed dry run showed` | The old data changed (or a typo). Nothing was written | Run the dry run again, review it, use the new fingerprint |
| `REFUSED: … blocking finding(s)` | Nothing was written | Fix those records in the old app, dry run again |
| `REFUSED: the new database is not ready` | Missing migrations, or data the tool did not write. Nothing was written | See "New database check" in the report |
| `ROLLED BACK: … validation check(s) failed` | Everything was written, the checks disagreed, and the transaction was undone | Read the failed checks in the report; this is a bug or a data case MAPPING.md does not cover |
| `FAILED: …` | An error stopped the run and the transaction was rolled back. Nothing was written | Fix the cause (network, permissions) and run `apply` again |
| The connection dropped during COMMIT | The only moment the result is unknown | Run `apply` again: if the first run committed, it inserts nothing and validates; if not, it migrates |
| `STOPPED: the old schema differs` | The old database changed shape | `migrate check` lists the columns that exist; update `src/legacy/schema-map.ts` |

A run that was interrupted (closed window, power cut) never commits, so the new database is unchanged; run
it again. Network errors are retried automatically, up to 3 attempts.

## 6. For developers

- **Code:** `src/legacy` reads the old database (only `schema-map.ts` names old tables and columns),
  `src/transform` plans the rows, `src/target` writes them, `src/verify` validates, `src/report` writes the
  run folder, `src/commands` holds the four commands.
- **Tests:** `pnpm --filter @pos/legacy-migration test` (unit) and `test:integration` (MIG-01–MIG-05 on local
  PostgreSQL). The integration fixture is the old production schema (`test/fixtures/legacy-schema.sql`) with
  invented data covering each case in MAPPING.md §9.
