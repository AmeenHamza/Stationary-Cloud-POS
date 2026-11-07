# Runbook: first deployment (staging, then production)

For the developer who sets the platforms up. It starts once the owner has decided U-01 to U-04, U-06 and
U-07 (DECISIONS.md §3) and created the accounts. Reference: DEPLOYMENT.md §1–§8. Do staging first and run
the staging checks before creating production.

## 1. Domain and DNS (U-03)

- Reserve `pos.<domain>` (web) and `api.<domain>` (API) on the shop's domain. `pos-staging.<domain>` and
  `api-staging.<domain>` for staging.
- The session cookie only works when web and API share the domain, so the `*.vercel.app` and
  `*.up.railway.app` addresses are not enough (ADR-011).

## 2. Neon (U-04)

1. Project `stationery-pos`, PostgreSQL 17, in the region Render will use (ADR-022).
2. Production: autosuspend **off**, point-in-time restore ≥ 7 days. Branch `staging` from `main`.
3. Roles: the app role (owns the schema), and a read-only backup role:
   `CREATE ROLE pos_backup LOGIN PASSWORD '<generated>'; GRANT pg_read_all_data TO pos_backup;`
4. Note the **pooled** URL (`DATABASE_URL`) and the **direct** URL (`DIRECT_DATABASE_URL`), both with
   `sslmode=require`.

## 3. Render (U-01)

1. Create the API service from the public repository, with environments `staging` and `production`.
2. Service `redis`: the pinned `redis:8.x-alpine` image, a volume on `/data`, `infra/redis/redis.conf`
   with a generated password and the `pos-api` ACL user (DEPLOYMENT.md §5). Private networking only.
3. Service `api`: this repository, Dockerfile `apps/api/Dockerfile`, migrations before each deploy, health
   check `/health/ready`, and custom domain `api.<domain>`.
4. Variables (DEPLOYMENT.md §4.1): `NODE_ENV=production`, `DATABASE_URL`, `DIRECT_DATABASE_URL`,
   `REDIS_URL`, `WEB_ORIGIN=https://pos.<domain>`, `SETTINGS_ENCRYPTION_KEY` (generated, see
   [rotate-secrets.md](rotate-secrets.md)), `METRICS_TOKEN` (generated), `TRUST_PROXY_HOPS=1`,
   `LOG_LEVEL=info`. Leave `GROQ_BASE_URL` unset; `GROQ_MODEL` only to override `openai/gpt-oss-120b`.
5. Deploy. The first deploy creates every table. Check `https://api.<domain>/health/ready`.
6. In Render, create a production deploy hook for the API service. In the GitHub repository settings, add it
   as the `RENDER_DEPLOY_HOOK_URL` repository secret. The `CI` workflow will then
   trigger `.github/workflows/deploy-render.yml` after successful checks on `main`. That workflow also copies
   the commit to the fork Vercel builds, using the `FORK_SYNC_TOKEN` repository secret (DEPLOYMENT.md §4.3).

## 4. Vercel (U-02)

1. Project with root `apps/web`, build `pnpm turbo run build --filter=@pos/web`, Node 24.
2. Variable `NEXT_PUBLIC_API_URL=https://api.<domain>` (the browser derives the WebSocket address from it).
3. Custom domain `pos.<domain>`. Security headers come from `next.config.ts`; Vercel adds HSTS.

## 5. First account and shop settings

1. Create the owner's admin account from the Render service shell or a one-off production job (the password
   is asked for, never typed on the command line):
   `pnpm --filter @pos/api cli:create-admin --username <name> --full-name "<Full Name>"`
   (from a machine with the repository built, `pnpm build`).
2. Sign in at `https://pos.<domain>`, then in Settings: shop name, address, phone, receipt footer, GST rate,
   and the Groq API key (AI Assistant).
3. Create the staff accounts (Staff screen). Every cashier gets their own account (D-10).

## 6. Operations (U-06, U-07)

1. GitHub environment `production` (manual approval) with the backup secrets from DEPLOYMENT.md §4.3. The
   deploy-hook secret is a repository secret so the API deployment remains automatic. Run
   `Weekly backup` by hand once and check the file in R2.
2. Do the restore drill in [restore.md](restore.md) and record it there.
3. Uptime monitor on `https://api.<domain>/health/live` every 5 minutes (no database or Redis cost).
4. Metrics scraper on `https://api.<domain>/metrics` with `Authorization: Bearer <METRICS_TOKEN>`, and the
   alert rules in DEPLOYMENT.md §8 (`pos_graphql_duration_seconds`, `pos_outbox_unpublished`,
   `pos_redis_up`, `pos_ws_connections`). Fire a test alert to the owner and the developer.

## 7. Staging checks before production

| Check | How |
|---|---|
| STG-01 | Make a sale, a refund and a khata payment on staging: transactions through the pooled endpoint work |
| STG-02 | Leave a counter open for 30 minutes: no "Live updates paused" banner, no requests (DevTools Network tab) |
| STG-03 | `curl -sI https://pos-staging.<domain>/login` shows the CSP, `strict-transport-security`, `x-frame-options: DENY`; sign in and confirm the API cookie is `__Host-pos_sid` (HttpOnly, Secure, SameSite=Strict) |
| STG-04 | Deploy a commit twice: the pre-deploy migration runs; then roll back with "Redeploy" of the previous deployment |

Then repeat sections 2–6 for production. Counter PCs: [counter-pc-setup.md](counter-pc-setup.md). Moving
from the old system: [cutover.md](cutover.md).
