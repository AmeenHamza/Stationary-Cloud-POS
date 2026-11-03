# Runbook: incidents

For whoever is on call (the developer, with the owner informed; U-07 sets who gets the alerts). Alerts and
thresholds: DEPLOYMENT.md §8.

## First five minutes

1. **Is billing working?** Ask a counter to scan a product and cancel before payment, or open
   `https://pos.<domain>/terminal` yourself.
2. Check the API: `https://api.<domain>/health/live` (the process) and `/health/ready` (`database: up`,
   `redis: up | degraded`).
3. Look at Railway logs for the `api` service (JSON lines; filter by `requestId` or `operation`), and at the
   error tracker if one is set up (U-07).
4. Tell the shop what to do now: keep billing, or switch to paper bills (internet or platform down).
5. Note the time; it goes into the incident note.

## Symptoms and actions

| What you see | Likely cause | Action |
|---|---|---|
| Counters show "Offline: billing paused" | Shop internet down, or the API down | Shop internet: paper bills, entered later (D-05; owner to confirm). API: check Railway status, redeploy the last good image (DEPLOYMENT.md §6 rollback) |
| `/health/ready` is 503 with `database: down` | Neon unreachable or the password changed | Neon status page; check `DATABASE_URL`. Billing stops until it is back |
| `redis: degraded` | Redis down or restarting | **Billing keeps working.** Live updates and imports wait; restart the `redis` service. Login still works (memory rate limit) |
| "Live updates paused, reconnecting…" never clears | WebSocket blocked or API restarting | Wait for the deploy to finish; check `pos_ws_connections`; refresh one counter to test |
| `pos_outbox_unpublished` above 0 for 5 minutes | Redis down or the publisher stuck | Restart `redis`, then `api`. Rows stay in PostgreSQL and are sent on restart; nothing is lost |
| Sales slow (`CreateSale` p95 above 1.5 s) | Neon compute cold or overloaded, or a lock | Check Neon compute (autosuspend must be off in production, U-04); check the logs for `lock_timeout` |
| An import job failed | A bad file, or Redis lost the queue | Open the import's failed rows; re-upload after fixing the file |
| AI says "unavailable" | Groq down, its limit reached, or Redis down | Billing is unaffected. Try later; "not configured" means the key is missing or was refused |
| Wrong totals, stock or balances | A bug or a bad manual change | Run `cli:verify-integrity` (read-only). If data is wrong, follow [restore.md](restore.md) or fix forward with the developer |
| A secret may have leaked | — | [rotate-secrets.md](rotate-secrets.md), then sign everyone out |

## After the incident

Write a short note in `docs/runbooks/incidents/<YYYY-MM-DD>.md`: what happened and when, what the shop
did meanwhile, the cause, the fix, and what will stop it happening again. No customer names, phone numbers or
secrets in the note.
