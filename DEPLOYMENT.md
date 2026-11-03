# DEPLOYMENT.md — Environments, Deployment and Operations

**Status:** Proposed, awaiting owner review (design stage). Nothing is deployed. Hosting choices follow D-24 and
DECISIONS.md ADR-022; open items are U-01–U-07.
**Last updated:** 2026-10-28

---

## 1. Environments

| Environment | Web | API + Redis | Database | Purpose |
|---|---|---|---|---|
| Local | `pnpm dev` (port 3000) | `pnpm dev` (port 4000) + Redis 8 (6379; Docker or WSL) | PostgreSQL 17 (5432; Docker or WSL) | Development |
| CI | Production build | Built API in-process | Service containers (PostgreSQL 17, Redis 8) | Tests |
| Staging | Vercel preview/staging domain `pos-staging.<domain>` | Railway environment `staging` | Neon branch `staging` | Rehearsal, smoke tests, owner training |
| Production | Vercel `pos.<domain>` | Railway environment `production` | Neon `main` branch | The shop |

Web and API must share a registrable domain (`pos.<domain>`, `api.<domain>`), so the session cookie is
same-site (ADR-011, U-03). The default `*.vercel.app` and `*.up.railway.app` hosts are **not** sufficient for
production.

---

## 2. Local development

**Prerequisites:** Node.js 24 LTS (`.nvmrc`), pnpm (version from `packageManager`), Git, and either Docker
Desktop or (Windows) WSL Ubuntu with PostgreSQL 17 and Redis 8 installed. The current development PC uses
the WSL option (installed 2026-10-29: PGDG `postgresql-17`, packages.redis.io `redis`, localhost-only, local
password in the git-ignored `.env`).

```
pnpm install
cp .env.example .env                    # compose passwords (local only)
cp apps/api/.env.example apps/api/.env  # points to localhost services
cp apps/web/.env.example apps/web/.env.local
pnpm services:up                        # docker compose if Docker exists, else the WSL services
pnpm db:migrate                         # prisma migrate dev (refuses non-localhost URLs)
pnpm db:seed                            # small fake dataset (no real customer data)
pnpm --filter @pos/api cli:create-admin --username admin
pnpm dev                                # turbo: web + api + package watchers
```

`pnpm services:up` (`scripts/dev/services-up.ts`) uses Docker Compose when available; on Windows without
Docker it starts the WSL services and a detached 12-hour WSL keep-alive (WSL otherwise stops idle
distributions and their services). `infra/docker-compose.yml`: `postgres:<major>-alpine` (same major as Neon) with `pg_trgm` and `citext`
available, and `redis:8-alpine` started with `infra/redis/redis.conf`. Both use pinned digests, healthchecks
and named volumes. Ports bind to `127.0.0.1` only.

---

## 3. Topology and services

| Platform | Service | Configuration |
|---|---|---|
| Vercel | `apps/web` | Root `apps/web`; build `pnpm turbo run build --filter=@pos/web`; Node LTS; security headers from `next.config.ts` |
| Railway | `api` | Dockerfile `apps/api/Dockerfile` (build context = repository root; `turbo prune` → install → build → production install, ADR-032); config-as-code path `apps/api/railway.json`: pre-deploy `pnpm --filter @pos/database migrate:deploy` (needs `DIRECT_DATABASE_URL`), healthcheck `/health/ready`, draining 45 s, restart on failure (5 retries); custom domain `api.<domain>`; region = Neon region (ADR-022) |
| Railway | `redis` | Image `redis:8.x-alpine` (pinned), volume `/data`, config §5, private networking only (no public domain or TCP proxy) |
| Neon | project `stationery-pos` | Branches `main` (production), `staging`, `pre-migrate-*` snapshots; pooled + direct connection strings |
| GitHub | Actions, environments `staging`, `production` | Production requires manual approval |

Optional scale-out: a second Railway service `worker` (same image, `WORKER_ONLY=true`) and `WORKER_ENABLED=false`
on `api`. Not needed at the current volume.

---

## 4. Environment variables

Validated at boot by Zod (`apps/api/src/config/env.schema.ts`, `apps/web/src/lib/env.ts`); invalid
configuration stops the process. "Secret" values live only in the platform's secret store and GitHub
environment secrets, never in the repository.

### 4.1 API

| Variable | Example / rule | Secret |
|---|---|---|
| `NODE_ENV` | `production` \| `staging` \| `development` \| `test` | |
| `PORT` | `4000` | |
| `DATABASE_URL` | Neon **pooled** URL, `sslmode=require` | yes |
| `SIGNUP_SECRET` | Shared sign-up key; keep private because it permits creating an Admin | yes |
| `DIRECT_DATABASE_URL` | Neon **direct** URL (migrations only) | yes |
| `REDIS_URL` | Redis connection URL; for Upstash use its TLS Redis URL (`rediss://`), not the REST URL or token | yes |
| `WEB_ORIGIN` | `https://pos.<domain>` (CORS and WebSocket `Origin` allowlist) | |
| `BUSINESS_TIMEZONE` | `Asia/Karachi` | |
| `SESSION_IDLE_HOURS` / `SESSION_ABSOLUTE_DAYS` | `12` / `7` | |
| `SETTINGS_ENCRYPTION_KEY` | base64 of 32 random bytes (Groq key encryption) | yes |
| `GROQ_MODEL` | unset: `openai/gpt-oss-120b` (ADR-041); set only to switch model | |
| `GROQ_BASE_URL` | unset in production; set to the stub in tests | |
| `TRUST_PROXY_HOPS` | `1` (Railway edge) | |
| `WORKER_ENABLED` / `WORKER_ONLY` | `true` / `false` | |
| `LOG_LEVEL` | `info` | |
| `SENTRY_DSN`, `SENTRY_ENVIRONMENT` | — | yes (DSN) |
| `METRICS_TOKEN` | random 32+ chars | yes |
| `PREVIOUS_SETTINGS_ENCRYPTION_KEY` | the old key, **only** while running `cli:rotate-settings-key`; never stored on Railway | yes |

### 4.2 Web

| Variable | Example | Secret |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.<domain>` (the GraphQL HTTP and WebSocket addresses are derived from it; `apps/web/src/lib/env.ts`) | |
| `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` | not wired yet: added with the error tracker (U-07) | yes (token) |

### 4.3 Tools and CI

| Variable | Used by | Secret |
|---|---|---|
| `POSTGRES_PASSWORD`, `REDIS_PASSWORD` | local docker compose (root `.env`) | local only |
| `LEGACY_DATABASE_URL` | `tools/legacy-migration`, **owner's machine only** (read-only role) | yes |
| `BACKUP_DATABASE_URL`, `BACKUP_AGE_RECIPIENT`, `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | `backup.yml` | yes |
| `RAILWAY_TOKEN`, `VERCEL_TOKEN` | deploy workflows (if deploys are triggered from CI) | yes |

---

## 5. Redis deployment

`infra/redis/redis.conf` (shared by local and Railway; the password and ACL are injected at start):

```
maxmemory 256mb
maxmemory-policy noeviction        # BullMQ requirement (ADR-007); all cache keys carry TTLs
appendonly yes
appendfsync everysec
save ""                            # AOF only
protected-mode yes
tcp-keepalive 60
notify-keyspace-events ""          # not used
# ACL: default user disabled; application user limited to its key and channel namespaces
# user default off
# user pos-api on ><password> ~pos:v1:* &pos:v1:* +@all -@admin -@dangerous +info
```

- **Network:** Railway private network (encrypted between services). No public endpoint. For Upstash or another
  public Redis endpoint, use its Redis/TLS URL (`rediss://`) with certificate verification, never its REST URL.
  Set the URL in `apps/api/.env` locally and the API's secret store in production. Preserve a separate local
  `TEST_REDIS_URL`; tests flush it. An Upstash deployment has not yet been verified: confirm Pub/Sub, BullMQ
  blocking commands and Lua scripts, `INFO`, no-eviction, connection limits, latency and realtime recovery
  before relying on it in production.
- **Version:** pinned image tag. Upgrades go through Renovate, staging first; a restart loses only cache and
  queue state (SYSTEM_DESIGN.md §6.5).
- **Verify at Phase 4:** BullMQ's Lua scripts and `INFO` work under the ACL above; adjust command categories
  if needed and record the result here.
- **Monitoring:** §8.

---

## 6. Release process

For local development against Neon, use a separate development branch: put its pooled URL in
`apps/api/.env` and `packages/database/.env`, and its direct URL in `packages/database/.env`. Apply reviewed,
non-destructive migrations with `pnpm --filter @pos/database migrate:deploy`; the local-only `db:migrate`
command intentionally refuses Neon. Redis remains required. Keep integration test URLs pointed at an isolated
local test database, not the development or production branch. The client's old database is a migration source,
not the new app's database.

Order is always **database → API → web**, so older web builds keep working against a newer API (additive
GraphQL changes, expand/contract migrations).

1. Merge to `main` (all CI gates green).
2. **Staging:** deploy the API to Railway `staging` (pre-deploy runs `migrate deploy` against the Neon `staging`
   branch), wait for `/health/ready`, deploy the web preview, run STG-01–STG-04.
3. **Production** (GitHub environment approval):
   1. Create a Neon branch `pre-migrate-<YYYYMMDD-HHMM>` from `main` (instant snapshot).
   2. Deploy the API: the pre-deploy migration runs; Railway starts the new instance, waits for health, routes
      traffic, then drains the old one for 45 s (sockets get `1012` and reconnect).
   3. Deploy the web app to Vercel production.
   4. Watch Sentry, error rate and `createSale` latency for 30 minutes.
4. Deploy outside shop hours when a migration is non-trivial.

**Rollback:**

| What failed | Action |
|---|---|
| Web | Vercel "Instant rollback" to the previous deployment |
| API (no schema change, or additive only) | Railway redeploy of the previous image |
| Migration broke data | Stop the API; restore from the `pre-migrate-*` branch (Neon restore or switch URLs); redeploy the previous image |
| Contract migration already ran | Forward fix only (that is why contract steps ship a release after expand) |

---

## 7. Backups and restore

Strategy: DATABASE.md §10. Operational details:

- `.github/workflows/backup.yml`, weekly (Sunday 03:00 PKT; also runnable by hand): `pg_dump --format=custom` with `BACKUP_DATABASE_URL` (a read-only
  role on the direct endpoint), encrypt with `age` for `BACKUP_AGE_RECIPIENT` (the private key is held offline
  by the owner), upload to R2 `backups/weekly/<date>.dump.age`, keep 12, verify the upload checksum. Each run
  costs roughly the database size in Neon egress; it is weekly for that reason.
- **Restore drill** (quarterly, and once before go-live): restore the latest dump into a scratch Neon branch,
  run `cli/verify-integrity.ts`, record date, duration and result in `docs/runbooks/restore.md`.
- Redis is not backed up (no business data); its AOF exists only to keep queued imports across restarts.

---

## 8. Monitoring and alerting

| Signal | Source | Alert (to owner + developer, U-07) |
|---|---|---|
| Unexpected errors | Sentry (web + API), PII scrubbed | New issue; > 10 events in 10 min |
| Availability | Uptime monitor → `GET /health/live` every 5 min (touches neither DB nor Redis) | 2 consecutive failures |
| API error rate | Logs/metrics: `INTERNAL_SERVER_ERROR` share | > 2 % over 5 min |
| Sale latency | `pos_graphql_duration_seconds{operation="CreateSale"}` p95 | > 1.5 s for 10 min |
| Redis | `pos_redis_up`, `used_memory`, cache hit ratio, command errors | Down > 2 min; memory > 70 %; hit ratio < 50 % for 1 h (informational) |
| Outbox | `pos_outbox_unpublished` | > 0 for 5 min |
| Realtime | `pos_ws_connections`, disconnect rate | Disconnect rate > 5/min sustained |
| Import queue | BullMQ failed count | Any failed job |
| Neon | Usage dashboard (daily transfer, compute) | Weekly review against NETWORK_OPTIMIZATION.md §8.4 |
| Logs | Railway logs (JSON); optional shipping to a log service | — |

Exported metrics: `pos_graphql_duration_seconds` (operation name, outcome), `pos_ws_connections`,
`pos_redis_up`, `pos_redis_errors_total`, `pos_outbox_unpublished`, `pos_outbox_publish_failures_total`,
`pos_cache_requests_total`, `pos_rate_limit_*`, plus Node process metrics. The error tracker (Sentry) is not
wired yet: it waits for U-07; until then unexpected errors are in the API logs with their `requestId`.
Runbooks: `docs/runbooks/` (incident, restore, rotate-secrets, first-deploy, counter-pc-setup, cutover).

`/metrics` (bearer token) can be scraped by Grafana Cloud's free tier, or a similar service, for dashboards and
alert rules. The scraper reads in-memory counters only; it never queries the database.

---

## 9. Counter PC setup

- Chrome shortcut: `chrome.exe --kiosk-printing --app=https://pos.<domain>/terminal` (silent printing, app
  window).
- Default printer: the 80 mm thermal printer; paper 80 mm × receipt; margins none (D-13).
- The barcode scanner works as a USB keyboard, sending a suffix `Enter`.
- Each cashier has a personal account (D-10). Lock the OS screen when away; sessions expire after 12 idle hours.
- Sleep or network loss is handled by reconnect and reconciliation. No refresh is needed.

---

## 10. Disaster recovery

Targets: **RPO ≤ 5 minutes** (Neon point-in-time restore), **RTO ≤ 2 hours** for a full platform outage with
data intact.

| Scenario | Response |
|---|---|
| Bad deploy | §6 rollback |
| Data corruption or accidental change | Neon PITR to a branch before the event; verify; switch; redeploy |
| Neon region outage | Wait for Neon; restore the latest weekly dump into another region **only** if the outage exceeds the business's tolerance (accepts up to a week of loss; owner decides) |
| Railway outage | Redeploy the API image and Redis to another region or a provider (Dockerfile is portable); update DNS for `api.` |
| Vercel outage | Redeploy `apps/web` on Railway as a container (`next start`); update DNS for `pos.` |
| Redis loss | None needed beyond restart (SYSTEM_DESIGN.md §6.5) |
| Leaked secret | Rotate per `docs/runbooks/rotate-secrets.md`: DB password (Neon), Redis ACL password, `METRICS_TOKEN`, Sentry DSN; `SETTINGS_ENCRYPTION_KEY` rotation re-encrypts the Groq key (`cli:rotate-settings-key`); sign everyone out (`cli:revoke-all-sessions --confirm`) |
| Internet outage at the shop | Billing paused (D-05). Manual fallback: paper bills, entered as sales when back online (they get the entry date). **Owner to confirm this procedure** |

---

## 11. Cutover from the old system

1. The owner shares the old schema (table and column names only, Q27). The developer writes
   `tools/legacy-migration/src/legacy/schema-map.ts` and a fixture DB for MIG tests.
2. The owner runs `--dry-run` against the old Neon DB and reviews the report (duplicates Q35, implausible
   values Q19, mismatched totals). They fix data in the old app, or approve the default handling.
3. Rehearsal: a full migration into the **staging** branch; staff training on staging.
4. Cutover (after closing time): stop billing on the old system → final dry-run → real run into production →
   verification report must match exactly → create staff accounts → set up counter PCs (§9) → smoke test
   (login, scan, cart, cancel before payment).
5. The old system stays available **read-only** for 30 days. It is not modified by the migration, which only
   reads it.
6. **Rollback window (first business day):** if a blocking defect appears, counters return to the old system.
   Bills created in the new system that day must be re-entered there manually. The migration is re-run later
   (idempotent, but only after clearing the new DB of that day's data). The owner decides.
