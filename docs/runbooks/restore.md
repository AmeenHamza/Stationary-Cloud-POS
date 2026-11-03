# Runbook: restore the database

For whoever runs operations (developer or owner). Strategy: DATABASE.md §10. Targets: data loss of at most
5 minutes, back in service within 2 hours (DEPLOYMENT.md §10).

**Stop billing first.** Tell the counters to stop and keep paper bills until this runbook says to resume.
Anything recorded after the restore point must be re-entered.

## When to use which source

| Situation | Restore from |
|---|---|
| Wrong data written, a bad migration, accidental change | **A. Neon point-in-time restore** (any moment in the retention window, ≥ 7 days) |
| Neon itself is down for longer than the shop can wait (owner decides) | **B. The weekly encrypted dump** in R2 (loses up to a week) |
| Redis lost or emptied | Nothing to restore: restart Redis (SYSTEM_DESIGN.md §6.5) |

## A. Neon point-in-time restore (preferred)

1. In the Neon console, project `stationery-pos`, create a branch from `main` **at a time just before the
   problem** (Branches → Create branch → "Past point in time"). Name it `restore-<YYYYMMDD-HHMM>`.
2. Check the branch before using it. From a machine with the repository built (`pnpm build`), using the
   branch's **direct** connection string:

   ```
   DATABASE_URL="<branch direct URL>" pnpm --filter @pos/api cli:verify-integrity
   ```

   Every line must say `PASS` (stock, khata, bill and refund arithmetic, bill numbers). Then compare the last
   few bill numbers with the counters' paper or receipts.
3. Switch production to it, either way:
   - **Restore onto `main`** (Neon "Restore" on the `main` branch from the chosen time; Neon keeps a backup
     branch of the replaced state), or
   - **Point the API at the branch**: in Railway (`production`, service `api`) set `DATABASE_URL` (pooled)
     and `DIRECT_DATABASE_URL` (direct) to the branch, then redeploy.
4. Empty the cache so nothing newer than the restored data is served: restart the Railway `redis` service.
   Only cache and queue state is lost (SYSTEM_DESIGN.md §6.5).
5. Check `https://api.<domain>/health/ready` answers `200`, sign in, scan a product, cancel before payment.
6. Resume billing. Re-enter paper bills made since the restore point (they get today's date).
7. Write an incident note ([incident.md](incident.md)).

## B. From the weekly encrypted dump

Needs the owner's offline **age private key** and the R2 credentials. Work on a trusted machine and delete
every plaintext copy afterwards.

1. Download the newest dump:
   `aws s3 cp s3://<bucket>/backups/weekly/<date>.dump.age . --endpoint-url <R2 endpoint>`
2. Decrypt: `age --decrypt --identity <owner-key.txt> --output pos.dump <date>.dump.age`
3. Create the target (a new Neon project or branch, in another region if the region is down) and restore
   with PostgreSQL 17 tools:
   `pg_restore --no-owner --no-privileges --dbname "<target direct URL>" pos.dump`
4. Run `cli:verify-integrity` against it as in A.2.
5. Point Railway at it as in A.3, then A.4 to A.7.
6. Delete `pos.dump` and the downloaded file.

## Restore drill (quarterly, and once before go-live)

Restore the newest weekly dump (B.1–B.4) into a scratch Neon branch, run `cli:verify-integrity`, record the
result below, then delete the scratch branch.

| Date | Source | Minutes | verify-integrity | By | Notes |
|---|---|---|---|---|---|
| — | — | — | — | — | Not run yet: needs production and the backup bucket (U-04, U-06) |
