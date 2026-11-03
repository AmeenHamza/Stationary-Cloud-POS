# DECISIONS.md — Architectural Decision Records

**Status:** Proposed, awaiting owner review (design stage). Nothing is implemented.
**Last updated:** 2026-10-28
**Inputs:** [FEATURES.md](FEATURES.md) (business decisions D-01–D-26, assumptions A-xx, open questions Q-xx)

Each ADR has: context, decision, alternatives considered, consequences. Business decisions (`D-xx`)
come from the owner and are referenced, not re-decided. Technical decisions here are **proposed** until the
owner approves the review gate.

---

## 1. Version policy

Use the latest **stable** release of each dependency at the start of implementation Phase 1. Canary,
nightly, beta and RC versions are not allowed. Exact versions are pinned in `package.json`
(no `^`/`~` for runtime dependencies) and in `pnpm-lock.yaml`. Renovate proposes upgrades weekly.

Versions were verified against the npm registry at Phase 1 (2026-10-29). A newer stable major is adopted
only if every dependent package supports it; rejected majors are recorded below with the reason.

| Area | Package / product | Pinned (verified 2026-10-29) | Why this version / constraint |
|---|---|---|---|
| Runtime | Node.js LTS | 24.22.1 | Docker/CI use Node 24 LTS. The dev PC's system Node is 25 (not LTS, rejected by `dependency-cruiser` engines), so a checksum-verified portable Node 24 is used for this repo |
| Package manager | pnpm | 11.20.0 | `packageManager` field; pnpm 11 uses `allowBuilds` for install scripts |
| Monorepo | turbo | 2.11.10 | — |
| Language | TypeScript | 6.0.3 | **7.0.2 rejected**: typescript-eslint supports `<6.1`, `@nestjs/graphql` supports `^5.5 \|\| ^6` |
| Web framework | next | 16.4.3 | — |
| UI runtime | react, react-dom | 19.3.1 | — |
| GraphQL client | @apollo/client | 4.3.5 | — |
| GraphQL | graphql | 16.14.2 | **17 rejected**: `@apollo/server` 5 peer is `^16.11` |
| Backend | @nestjs/core, common, platform-express | 12.3.2 | NestJS 12 (newer than the 11 assumed at design time) |
| Backend GraphQL | @nestjs/graphql / @nestjs/apollo / @apollo/server | 14.1.0 / 14.1.1 / 5.5.1 | Express 5 integration `@as-integrations/express5` |
| WebSocket protocol | graphql-ws / ws | 6.4.1 / 8.22.0 | — |
| Pub/Sub | ioredis | 6.0.0 | **`graphql-redis-subscriptions` not adopted**: last release 2024-12, so ADR-008's fallback (own `RedisPubSub`) applies |
| ORM | prisma, @prisma/client, @prisma/adapter-pg | 7.10.1 | **8.0.0-rc rejected** (pre-release, even though npm `latest` points to it) |
| Database | PostgreSQL | 17 (local 17.11) | Same major as Neon production |
| Cache / broker | Redis Open Source | 8 (local 8.10.3) | — |
| Jobs | bullmq | 6.5.1 | `noeviction` Redis. **`@nestjs/bullmq` dropped** (ADR-040): its workers wait forever to connect and to close while Redis is down. 6.5.3 skipped: under 24 h old at install |
| Import / export files | exceljs / csv-parse / csv-stringify / pdfkit | 4.4.0 / 7.0.3 / 6.9.0 / 0.20.2 | exceljs carries two moderate transitive advisories, accepted in ADR-040 |
| AI provider client | groq-sdk | 1.6.0 | No dependencies; called through `infrastructure/ai/groq.client.ts` only (ADR-041) |
| AI answer rendering | react-markdown / remark-gfm | 10.1.0 / 4.0.1 | Raw HTML skipped, links and images not rendered (ADR-041) |
| Transactions | nestjs-cls / @nestjs-cls/transactional / adapter-prisma | 7.0.2 / 4.0.2 / 2.0.2 | — |
| Rate limiting | in-repo `RateLimiterService` (ioredis Lua) | — | **`@nestjs/throttler` not used** (ADR-024, revised at Phase 4); `@nest-lab/throttler-storage-redis` also declares Nest ≤ 11 only |
| Logging | pino / nestjs-pino / pino-http | 10.4.0 / 5.3.1 / 11.0.0 | — |
| Money / dates | decimal.js | 10.6.0 | Business dates use the built-in `Intl` API with an IANA time zone, so no date library is needed (`date-fns` dropped) |
| Validation | zod | 4.6.7 | — |
| Styling | tailwindcss / @tailwindcss/postcss / tw-animate-css | 4.3.3 / 4.3.3 / 1.4.0 | CSS-first configuration in `apps/web/src/app/globals.css` (design tokens, light/dark) |
| UI primitives | radix-ui / class-variance-authority / clsx / tailwind-merge / lucide-react / sonner | 1.8.1 / 0.7.1 / 2.1.1 / 3.7.0 / 1.63.0 / 2.0.8 | shadcn/ui-style components kept in `components/ui`; **lucide-react 1.64.0 skipped**: under 24 h old at install time (pnpm release-age gate) |
| Forms | react-hook-form / @hookform/resolvers | 7.91.0 / 6.0.2 | Zod 4 resolver; every form schema comes from `@pos/validation` |
| GraphQL codegen | @graphql-codegen/cli / client-preset / @graphql-typed-document-node/core | 7.4.6 / 6.2.3 / 3.2.0 | Output in git-ignored `src/graphql/__generated__`; `build`, `lint`, `test` and `dev` depend on `codegen` in turbo |
| E2E browser | Playwright Chromium | v1248 (Chrome for Testing 156) | Locally installed under `D:\.pos-tools\ms-playwright` (`PLAYWRIGHT_BROWSERS_PATH`) because drive C: is full |
| Passwords | @node-rs/argon2 | 2.2.2 | — |
| Tests | vitest / @playwright/test / unplugin-swc | 5.0.5 / 1.64.1 / 2.0.0 | Testcontainers not used (ADR-023); API test configs are `.mts` and resolve `graphql` to its CommonJS entry, as Node does |
| Quality | eslint / typescript-eslint / prettier / dependency-cruiser / jscpd / gitleaks | 10.13.0 / 8.72.1 / 3.9.10 / 18.7.0 / 5.4.2 / 8.30.1 | gitleaks is a checksum-verified release binary locally; the GitHub Action in CI |

Versions not yet installed (apps not built yet) are pinned when the phase that introduces them starts, and
this table is updated then.
---

## 2. Architectural decision records

### ADR-001 Modular monolith
- **Context:** One shop, 2+ counters (D-04); low volume (≈ 50 bills/day observed).
- **Decision:** A NestJS **modular monolith** with explicit module boundaries, plus a Next.js frontend.
- **Alternatives:** Microservices (rejected: operational cost, distributed transactions for sale + stock + khata).
- **Consequences:** A single deployable API. Background jobs run in the same process (ADR-020). The
  API can scale horizontally behind Redis (ADR-007/008) without code changes.

### ADR-002 pnpm workspaces + Turborepo
- **Decision:** pnpm workspaces for dependency isolation; Turborepo for task graph and caching.
- **Alternatives:** Nx (heavier, generators not needed); npm/yarn workspaces (weaker strictness).
- **Consequences:** Root `turbo.json` defines `build`, `lint`, `typecheck`, `test`, `codegen`,
  `schema:emit`. Shared packages are compiled (ADR-030).

### ADR-003 Rendering strategy: static shells, client-side data
- **Context:** Every screen is authenticated, real-time and backed by a normalized Apollo cache that
  receives subscription events. No SEO.
- **Decision:** Layouts, navigation chrome, login page, error and not-found pages are **React Server
  Components rendered statically**. Data screens are **client components** that fetch with Apollo after
  hydration; on the server they render skeletons only. No server-side GraphQL fetching.
- **Why not server data fetching:** it would add a second network path (Vercel → API) with separate
  cookie forwarding, duplicate requests during hydration, and data that the client cache still has to
  receive and keep live. Static shells cost no server compute and load from the CDN.
- **Consequences:** First paint shows the shell and skeletons; data arrives in one round trip.
  Route guard is client-side via the `me` query (ADR-011); the API enforces all authorization.

### ADR-004 NestJS + Apollo Server, GraphQL code-first
- **Decision:** `@nestjs/graphql` with the Apollo driver on the Express platform. **Code-first**: TypeScript
  classes with decorators are the source of truth. The SDL is emitted to
  `packages/contracts/schema.graphql` and committed.
- **Alternatives:** Schema-first (rejected: SDL and TS types would be maintained twice); Mercurius/Fastify
  (rejected: less common with NestJS; no measured need); Yoga (fine, but Apollo is the NestJS default).
- **Consequences:** CI fails if the committed SDL differs from the emitted one (`check:schema`).
  Breaking schema changes need a deprecation release (API.md §1).

### ADR-005 Prisma ORM (vs TypeORM)
- **Decision:** Prisma ORM with the `pg` driver adapter.
- **Why:** Generated, fully typed queries; explicit `select` projections (critical for Neon transfer);
  reliable migration workflow; multi-file schema keeps each file under 200 lines; field references allow
  column-to-column comparisons (low-stock); `TypedSQL` for the few hand-written reporting queries.
- **TypeORM rejected because:** decorator entities encourage loading whole entity graphs; weaker type
  safety for partial selects; migration generation is less predictable.
- **Consequences:** Check constraints, partial and trigram indexes are added by editing the generated
  migration SQL (`prisma migrate dev --create-only`). Prisma `update` returns all columns unless `select` is
  given; repositories always pass `select` (NETWORK_OPTIMIZATION.md §5).

### ADR-006 PostgreSQL on Neon (D-24)
- **Decision:** Neon Postgres. The API uses the **pooled** connection string (`DATABASE_URL`); migrations use
  the **direct** string (`DIRECT_DATABASE_URL`).
- **Consequences:** Neon bills data **egress** (bytes sent from Neon). This is the primary network
  budget (A-05). Autosuspend causes a cold start on the first query after idle; production should disable
  it or accept the delay (U-04). Neon branches give instant pre-migration snapshots (DEPLOYMENT.md §7).

### ADR-007 Redis is mandatory (D-26)
- **Decision:** One Redis Open Source 8 instance per environment. It runs locally from Phase 1 (docker
  compose) and is wired into the API in Phase 4, the API foundation, before any feature exists. Uses:
  session cache, cache-aside for categories/settings/AI results, shared rate limiting, Pub/Sub fan-out
  for GraphQL subscriptions, BullMQ for product imports. **No Redis locks** in v1 (SYSTEM_DESIGN.md §6.7).
- **Eviction:** `maxmemory-policy noeviction`. BullMQ requires it; evicting a job lock would cause duplicate
  processing. Every cache key has a TTL, and cache writes that fail with OOM are logged and ignored.
- **Alternatives:** Two Redis instances (cache with `allkeys-lru`, queue with `noeviction`). Rejected for
  v1: the cache is a few MB; one instance with memory alerts is enough. Revisit if memory exceeds 60%.
- **Consequences:** PostgreSQL stays the only source of truth. Every Redis use has a defined degraded mode
  (SYSTEM_DESIGN.md §6.5). No Redis distributed locks guard financial data.

### ADR-008 Subscriptions: `graphql-ws` + Redis Pub/Sub
- **Decision:** GraphQL subscriptions over the `graphql-transport-ws` protocol (`graphql-ws` library) on
  `wss://api.<domain>/graphql`. Cross-instance delivery uses a thin in-repo `RedisPubSub` over `ioredis`
  (`apps/api/src/infrastructure/realtime/redis-pubsub.ts`, ≤ 150 lines) with per-audience channels.
- **Alternatives:** Socket.IO with its Redis adapter (rejected: a second protocol beside GraphQL, custom
  event typing instead of schema-typed subscriptions); SSE (rejected: no NestJS GraphQL integration);
  `graphql-redis-subscriptions` (rejected at Phase 1: no release since 2024-12, so not demonstrably
  maintained).

### ADR-009 Transactional outbox with event-triggered publication
- **Context:** Redis Pub/Sub is fire-and-forget. A crash between commit and publish, or a Redis outage,
  would lose events while clients stay connected to other instances.
- **Decision:** Every state-changing transaction inserts its events into `outbox_events` in the **same
  transaction**. After commit, the instance publishes them and sets `published_at`. Unpublished rows are
  drained **on API startup and on the Redis `ready` event** using `FOR UPDATE SKIP LOCKED`. There is no
  periodic relay loop. Old rows are pruned on write (every 1,000th insert deletes rows older than 7 days).
- **Consequences:** At-least-once publication; clients de-duplicate by `seq` (ADR-010). One extra insert
  and one update per transaction.

### ADR-010 Client recovery: targeted refetch, not log replay
- **Context:** Outbox `seq` values are allocated before commit, so they do not arrive in commit order, and
  rolled-back transactions leave permanent gaps. Replaying "events after seq N" can therefore skip events.
- **Decision:** Events are **hints**. Entity `version` fields order cache patches. After a reconnect, or a
  `system.resyncRequired` event, the client refetches only its **active** queries (each ≤ 50 rows) and
  products in the cart (`productsByIds`, ≤ 50 ids). Inactive list fields are evicted so they refetch on
  their next mount. `seq` is used only for de-duplication and diagnostics.
- **Consequences:** Recovery cost is bounded by what is on screen. No full-catalogue reloads.

### ADR-011 Sessions: opaque token cookie, Postgres sessions, Redis cache
- **Decision:** On login the API sets `__Host-pos_sid` (32 random bytes, `HttpOnly; Secure; SameSite=Strict;
  Path=/`, host-only on the API domain). `sessions` stores the SHA-256 hash. The principal is cached in
  Redis for 5 minutes. Idle timeout 12 h, absolute lifetime 7 days.
- **Alternatives:** JWT access/refresh (rejected: disabling a cashier must take effect immediately; revocation
  lists recreate sessions anyway).
- **Consequences:** Web and API must share a registrable domain (`pos.<domain>`, `api.<domain>`) so the cookie
  is same-site (U-03). The web app has no auth middleware; the `(app)` layout gates on the `me` query.

### ADR-012 Validation with Zod, shared
- **Decision:** Input rules live once in `@pos/validation` (Zod). The web app uses them via React Hook Form's
  Zod resolver; the API applies them with a `ZodValidationPipe` on resolver arguments.
- **Alternatives:** class-validator on the API plus Zod on the web (rejected: duplicate rules).
- **Consequences:** GraphQL InputType classes declare shape only. A contract test asserts each InputType's
  fields match its Zod schema's keys.

### ADR-013 Money: `numeric(12,2)`, `decimal.js`, one calculation module
- **Decision:** Amounts are `numeric(12,2)` in Postgres, `Decimal` in TypeScript, and a `Money` string scalar in
  GraphQL. Bill and refund maths live once in `@pos/domain`. The terminal uses it for the cart **preview**;
  the API recomputes from database prices and is authoritative. The client sends `expectedTotal`; a
  mismatch returns `PRICE_CHANGED` with the server quote and creates nothing.
- **Consequences:** No floating point anywhere in money paths (lint rule bans `Number()`/`parseFloat` on
  Money values in domain and sales code).

### ADR-014 Bill numbering: per-day counter in the sale transaction
- **Decision:** `bill_number_counters(business_date, last_value)` is incremented with
  `INSERT … ON CONFLICT … DO UPDATE … RETURNING` inside the sale transaction. Format
  `ORD-YYYYMMDD-NNN` (at least 3 digits) with the Asia/Karachi business date. `orders.bill_number` is unique.
- **Alternatives:** Postgres sequence (rejected: not resettable per day, gaps on rollback); Redis INCR
  (rejected: not transactional with the sale).
- **Consequences:** Numbers are gapless for committed sales. Concurrent sales serialize briefly on the
  counter row, which is negligible at this volume.

### ADR-015 Idempotency keys on business rows
- **Decision:** Every financial or stock mutation takes a client-generated UUIDv7 `idempotencyKey`, stored with a
  unique constraint on the business row (`orders`, `refunds`, ledger entries, stock movements) together with a
  SHA-256 `request_hash`. A replay with the same key returns the original result; a different payload
  returns `IDEMPOTENCY_KEY_REUSED`.
- **Alternatives:** A Redis idempotency cache (rejected: not transactional; lost on Redis failure).

### ADR-016 Stock: cached balance plus movement ledger
- **Decision:** `products.stock_pieces` holds the current balance, updated atomically
  (`UPDATE … SET stock_pieces = stock_pieces - $n`) under row locks taken in ascending product id order.
  Every change inserts a `stock_movements` row with `balance_after`. Negative stock is allowed (D-16).
- **Consequences:** Reads of current stock are O(1). A verification query proves
  `Σ movements = stock_pieces` (TESTING.md FIN-22).

### ADR-017 Pagination: forward keyset connections, max 50
- **Decision:** Every list returns a `…Connection { nodes, pageInfo, totalCount }`. Arguments are `first`
  (default 50, max 50, enforced in the API) and an opaque `after` cursor. The keyset is (sort column, id).
  `totalCount` runs only when selected. "Previous page" uses a client-side cursor stack.
- **Alternatives:** Offset pagination (rejected: unstable under inserts, slow on deep pages); Relay `edges`
  (rejected: verbose payloads for no benefit here).

### ADR-018 Apollo Client + GraphQL Codegen
- **Decision:** Apollo Client 4 with a normalized cache, `typePolicies` for pagination, and one `graphql-ws`
  link. Codegen's client preset generates typed documents from `packages/contracts/schema.graphql`.
- **Alternatives:** urql (smaller, but its cache needs more hand-written updaters for event patching);
  TanStack Query (not GraphQL-normalized; event patches would duplicate entity handling).
- **Consequences:** `pollInterval` and `startPolling` are banned by lint (CODING_STANDARDS.md §6).

### ADR-019 UI system and state management
- **Decision:** Tailwind CSS 4 + shadcn/ui (Radix primitives, accessible). Server state lives in the Apollo
  cache. Local UI state uses React state and `useReducer`. The cart is a terminal-scoped reducer context,
  persisted to `localStorage` per user. Theme uses `next-themes`. **No Redux, Zustand or other global store.**
- **Why no global store:** The only cross-screen client state is the viewer (Apollo cache), connection status
  (a context) and theme (`next-themes`).

### ADR-020 Background jobs: BullMQ for product import only
- **Decision:** One BullMQ queue, `product-import`, processed inside the API process. The upload is parsed and
  staged in Postgres (`import_jobs`, `import_job_rows`) **before** enqueueing, so Postgres holds the state.
  Exports (CSV/XLSX/PDF) are synchronous streamed downloads that read in keyset batches.
- **Why:** An import of ~2,500 rows takes seconds, needs progress reporting and must survive a client
  disconnect. Exports of that size finish in about a second and need no stored result.
- **Consequences:** Bill creation, stock and ledger changes never run as jobs. If Redis is down, uploads are
  stored as `QUEUED` and enqueued on Redis `ready`.

### ADR-021 No object storage in v1
- **Decision:** None of the features need stored files. There are no product images; imports are staged
  in Postgres; exports are streamed; receipts are printed from the browser. Off-site backups use the bucket
  chosen in U-06.

### ADR-022 Hosting (implements D-24)
- **Decision (proposed):** Neon (database), Vercel (web), **Railway** (API service plus the official
  `redis:8` image on Railway's private network), all in the region nearest Pakistan that all three offer,
  measured from the shop before go-live.
- **Why Railway:** It runs the official Redis 8 image, as D-26 requires, and Render's managed Key Value is
  Valkey-based. Railway has private networking, always-on containers, zero-downtime deploys gated by health
  checks, and pre-deploy commands for migrations.
- **Alternatives:** Render (managed Key Value is Valkey); Fly.io (more operational work; managed Redis via
  Upstash, where per-command pricing is a poor fit for BullMQ's blocking commands); one VPS (owner chose
  managed hosts).
- **Open:** U-01 (confirm the host), U-02 (Vercel plan: the Hobby tier is for non-commercial use).

### ADR-023 Testing stack
- **Decision:** Vitest everywhere (API via `unplugin-swc`); Playwright for end-to-end and network-byte tests.
  Integration tests use **real PostgreSQL and Redis from `TEST_DATABASE_URL` / `TEST_REDIS_URL`** (WSL
  services locally, service containers in CI), one migrated template database per run cloned per file, and
  `@pos/testkit`'s TCP proxy to cut, stall and restore either link. HTTP tests use `fetch` against the real
  app on a random port (no supertest).
- **Revised at Phase 4:** Testcontainers was planned but needs Docker, which the development machine lacks;
  the proxy gives the same outage control without it.

### ADR-024 Rate limiting
- **Decision (revised at Phase 4):** an in-repo `RateLimiterService`
  (`infrastructure/rate-limit/rate-limiter.service.ts`): one atomic Lua fixed window (`INCR` + `PEXPIRE` +
  `PTTL`) per named bucket (`buckets.ts`, API.md §8), keyed by what the bucket limits (username, IP, user,
  counter), not by route. Each bucket declares its Redis-down policy: auth buckets fall back to a bounded
  in-memory window per instance (`memory-window.ts`); `default`/`sale` **fail open**; `ai`/`export`/`import`
  fail closed. Callers invoke `consume(bucket, key)`; Phase 5 adds the guard/decorator that calls it.
- **Why not `@nestjs/throttler`:** its storage adapter for Redis declares NestJS ≤ 11 only, and per-bucket
  keys and Redis-down policies needed custom code anyway, so the library would only have added a guard.

### ADR-025 Receipt printing
- **Decision:** The receipt is a React component printed with `window.print()` using `@page { size: 80mm auto }`
  CSS (D-13). Counter PCs run Chrome with `--kiosk-printing` for silent printing. The `createSale` response
  already contains the receipt, so printing needs no extra request.
- **Alternatives:** WebUSB/ESC-POS (Chrome-only, printer-specific); QZ Tray (paid local agent).

### ADR-026 AI Assistant (D-22)
- **Decision:** Groq through `groq-sdk`. The model is set in env `GROQ_MODEL`. AI operations are **mutations**,
  so reconnect reconciliation never re-runs them. Prompts get bounded aggregates only (≤ 50 rows) and never
  customer names or phones (Q17b). "Ask Your POS" uses whitelisted read-only tools mapped to reporting queries.
  Results are cached 15 minutes in Redis.

### ADR-027 No multi-tenancy (D-04)
- **Decision:** No `tenant_id`/`branch_id` columns. Event scoping is by role and user only.
- **Consequences:** Multi-shop use would need a migration that adds a tenant key to every table. Accepted
  per D-04.

### ADR-028 Archive instead of delete (D-12)
- **Decision:** Orders, refunds and ledger entries are never deleted. Lists default to the last 90 days and
  offer "Show archived". Products, customers and vendors are soft-archived (`archived_at`). Categories are
  deleted after their products move to Uncategorised (Q16b).

### ADR-029 Transaction propagation via CLS
- **Decision:** `@nestjs-cls/transactional` with the Prisma adapter. Application services run each use case
  through `UnitOfWork.run(fn)` (`infrastructure/unit-of-work/unit-of-work.ts`), which wraps
  `TransactionHost.withTransaction`, sets local timeouts, retries serialization/deadlock failures and, after
  commit, runs the after-commit work collected in CLS (outbox publication, cache invalidation; ADR-009).
  Repositories obtain the active client from `TransactionalClient`
  (`infrastructure/prisma/transactional-client.ts`), the one place that types the adapter's client as
  `Prisma.TransactionClient` (the adapter infers `never` from Prisma 7's `$transaction` overloads).
- **Verified at Phase 4:** a real PostgreSQL deadlock (40P01) raised through the pg driver adapter is
  recognised and retried (`unit-of-work.int.spec.ts`).
- **Alternatives:** Passing `tx` through every call (noisy, error-prone).

### ADR-030 Compiled internal packages
- **Decision:** `@pos/contracts`, `@pos/domain` and `@pos/validation` build with `tsup` to ESM + CJS + `.d.ts`.
  `@pos/database` exports the generated Prisma client.
- **Why:** The API compiles with SWC and does not transpile workspace TypeScript; Next.js can consume compiled
  output without `transpilePackages`.

### ADR-031 Security baseline
- **Decision:** argon2id password hashing; `helmet`; CORS allowlist with one web origin; Apollo CSRF
  prevention; WebSocket `Origin` check; GraphQL depth limit 10 and complexity limit 1,000; introspection off in
  production; AES-256-GCM encryption for the Groq key; audit log for sensitive actions (SYSTEM_DESIGN.md §9).

### ADR-033 Access policies and the global guard (Phase 5)
- **Decision:** three handler policies in `common/auth/access-policy.ts`: `@Public()`, `@Authenticated()` and
  `@RequirePermission(p)`. One global `AccessGuard` reads the policy, resolves the session through the
  `PRINCIPAL_RESOLVER` token (implemented by `modules/auth`, so `common` imports no module) and checks
  `ROLE_PERMISSIONS`. A handler with no policy is refused (fail closed); SEC-01 walks every provider and
  controller through Nest's `DiscoveryService` and fails the build on a missing policy.
- **Why `@Authenticated()`:** `me`, `logout` and `changePassword` need a session but no permission; mapping them
  to an arbitrary permission would hide that.

### ADR-034 Phases 5 and 6 built together (owner choice, 2026-10-30)
- **Decision:** the auth API (Phase 5) and the web foundation (Phase 6) are delivered as vertical slices, so login
  works in the browser first; from then on every feature ships its API and screen together.
- **Why:** the owner asked for the UI to appear with each feature instead of after all backend phases.
- **Consequence:** the ledger tracks both phases as in progress until their remaining items (realtime module,
  connection banner) are done.

### ADR-032 API container build (Phase 4)
- **Decision:** `apps/api/Dockerfile` prunes the monorepo with `turbo prune @pos/api --docker`, installs from the
  lockfile, builds, then reinstalls production dependencies only; the runtime stage runs as `node` from
  `/repo/apps/api`. Railway's pre-deploy runs `pnpm --filter @pos/database migrate:deploy` in that image
  (`prisma` is a production dependency of `@pos/database`; OpenSSL is installed for its schema engine).
- **Why not `pnpm deploy`:** without `injectWorkspacePackages`, `pnpm deploy --legacy` links workspace packages
  back into the source tree (verified: junctions into `packages/*`), so a copied output would have dangling
  links; enabling injection would change local development linking for every package.
- **Related:** `.env` files are loaded with Node's built-in `process.loadEnvFile` (local development only);
  `dotenv` was removed, so `prisma.config.ts` also works in the production install. Deployable packages
  declare `files` so build output is included although `dist/` is git-ignored.
- **Verification:** the stages were replayed without Docker (prune → frozen install → build → production
  install → boot in production mode → `migrate deploy` on a throwaway database). The image itself is first
  built by CI/Railway (Phase 15).

### ADR-035 Query cost model (refines ADR-031, 2026-10-31)
- **Decision:** the 1,000 limit stays. A connection costs `1 + first × item cost`; object fields cost 1;
  scalar and enum fields (and `__typename`) cost 0. A page of 50 full product rows costs about 101; 20 such
  pages in one request (1,020) are refused (SEC-09 integration test).
- **Why:** the first model charged every scalar inside a row `first` times, so the documented products page
  (50 rows × the product fragment) cost 1,301 and the API refused its own screen (found by e2e). Scalars are
  columns of rows already fetched; rows and nesting are what cost the database.
- **Also:** invalid variables, which `graphql-query-complexity` coerces before Apollo does, are now reported
  as `BAD_USER_INPUT` instead of an internal error.

### ADR-036 Realtime client and catalogue screens (Phases 6–7, 2026-10-31)
- **Connection status:** `reconnecting` (amber banner) after any failed attempt, including when the first
  connection never succeeds; `offline` (red) when `navigator.onLine` is false or the last HTTP request failed
  at network level, until the next success. Status events from a disposed client are ignored.
- **Aggregate refetch:** coalesced per operation-name set, at most one per 1.5 s, only for mounted queries
  (`refetchQueries({ include: 'active', onQueryUpdated })`). Operation names live in
  `lib/realtime/live-queries.ts`; feature tests assert they match the real documents.
- **Edit forms keep the version they opened with.** A live update elsewhere does not silently refresh the
  form; saving then fails with `CONFLICT` instead of overwriting the other admin's change. The shop
  settings form (five fields) remounts on a new version instead.
- **Category detail** is the products screen filtered by category (`/products?category=<id>`), not a
  separate table: one list implementation, the same 50-row keyset contract.
- **Per-socket subscription cap** counts graphql-ws's id reservations (`ctx.subscriptions`), so subscribes
  sent together cannot exceed it (found by the realtime integration test).

### ADR-037 Khata: one module, one ledger engine (Phase 8, 2026-10-31)
- **Decision:** customers and vendors live in one `modules/khata` (`customers/`, `vendors/`, `ledger/`)
  instead of two modules. Both kinds post through one `LedgerPosting` engine behind a `PartyStore`
  interface: `balance = balance + delta` in one locked statement, the entry with that `balance_after`, the
  `<kind>.balanceChanged` event and the audit row, in the caller's transaction (a sale joins it).
- **Why:** the two khatas differ only in entry types and labels (D-20). Two modules would have duplicated the
  posting, archive (zero balance, Q33) and 90-day window code (rule 4). Sales depend on `KhataModule` for
  `postCreditSale` / `postRefundCredit` only.
- **Money in events** is always two-decimal text (`moneyText`, e.g. `"75.00"`), the same as the `Money`
  scalar, so a client patch never shows `"75"` where a query showed `"75.00"`.

### ADR-038 Billing terminal and refunds (Phase 9, 2026-10-31)
- **Shared maths:** discount and Bill GST entries are parsed by `@pos/domain` `billDiscountOf`/`billGstOf`,
  and a stored bill becomes refund input via `refundSnapshotOf`; the API and the browser call the same
  functions, so the preview total is the `expectedTotal` the server checks (ADR-013).
- **Payment is a dialog over the terminal**, not a `/terminal/payment` route: the product grid, cart and
  live cache stay mounted, and the sale result (receipt) has no route state to carry. The cart lives in
  `CartProvider` in the terminal layout.
- **Cart products come from the cache:** a `productsByIds` field policy answers from cached products when
  all are present, so adding from the grid or a scan costs no request; only a cart restored after a reload
  fetches (≤ 50 ids per request).
- **Pending sale:** the input and key are saved before sending; network failures and a 30 s timeout
  (`AbortSignal.timeout`, no timers) re-send the same key up to 5 times with jittered back-off, waiting for
  `online`; GraphQL errors clear it; a reload asks `saleStatus` once. "Process Payment" stays disabled while a
  sale is unconfirmed, so a sale is never re-sent under a new key.
- **Receipt components are shared** (`components/receipt`), because order history (reprint) and the terminal
  both print and features may not import each other both ways. The terminal imports `features/orders` for
  the refund modal; orders never imports the terminal.
- **Order history** counts `order.created` for an "N new orders" banner instead of refetching on every sale;
  `order.refunded` patches the cached bill.
- **Bill-number prefix index** is partial (`WHERE bill_number IS NOT NULL`, always true) because Prisma
  cannot express `varchar_pattern_ops` and reports a plain one as drift; the planner still uses it for
  `LIKE 'ORD-20261028%'`.

### ADR-039 Dashboard (Phase 10, 2026-10-31)
- **Aggregates as tagged `$queryRaw` in `modules/reporting/persistence`, not TypedSQL.** `prisma generate
  --sql` needs a live database at build time (CI, the Railway image); INSTRUCTIONS.md allows tagged
  templates. Every field of `Dashboard` is one SQL statement, run only when selected; discount and tax
  share one statement per request.
- **Two queries:** `DashboardLive` (tiles, summaries, payment methods: ≤ 5 statements, ≤ 3 KB) is refetched,
  coalesced and only while the overview is open, on `order.created`, `order.refunded`, `stock.changed` and
  `customer.balanceChanged`; `DashboardHistory` (months, last 7 days, rankings) is read once and on
  "Refresh". The low-stock tile reuses the `lowStockCount` query instead of a second copy of its rule.
- **Charts are plain HTML/CSS** in `components/charts` (no chart library): columns ≤ 24 px with rounded
  tops, one axis, hover and focus tooltips, a screen-reader table. Colours were validated with the dataviz
  palette checks against this app's card surfaces: accent `#2a78d6`/`#3987e5`, context gray
  `#8f8d86`/`#7a7972` (≥ 3:1). Payment methods are ranked bars instead of the old donut.
- **Admins land on `/dashboard`** after login (it was Staff until the overview existed).

### ADR-040 Product import and exports (Phase 11, 2026-10-31)
- **BullMQ without `@nestjs/bullmq`.** `QueueRuntime` (infrastructure/queue) creates the queue and worker only
  once Redis is ready and caps shutdown at 5 s. With the Nest wrapper, an API started while Redis was down
  never finished shutting down (found by `schema:emit`, which boots without Redis).
- **Staging before queueing (ADR-020):** rows are validated at upload. A repeated barcode, a bad cell and an
  unknown category (Q37) fail their row; the rest run in batches of 100, one transaction each, falling back
  to row by row if the database refuses a batch. Only `PENDING` rows are read, so retries never apply a
  row twice. Products are written by the catalogue's `ProductImportService` (one owner of product writes);
  stock is set only for new products (BR-03); one `catalog.bulkChanged` replaces per-product events.
- **The `import` rate limit falls back to memory when Redis is down** (it was "fail closed" in API.md §8),
  reconciling it with ADR-020 and RED-08, which require uploads to stage while Redis is down.
- **Exports** stream in keyset batches of 500 (two statements per batch) through csv-stringify, ExcelJS's
  streaming writer and pdfkit. Product exports use the import template's headers, so an edited export can be
  imported again. Text cells that start with `= + - @`, a tab or CR get a leading apostrophe (SEC-14). The PDF
  leaves out Urdu names (its built-in fonts have no Urdu glyphs).
- **Accepted advisories (moderate):** `uuid` via exceljs (buffer bounds in v3/v5/v6; exceljs only generates
  v4 ids). Overriding it would break exceljs's older dependencies; revisit when exceljs updates. `minimatch`
  (pattern ReDoS): since Phase 14 the only path is eslint's config loader, a development tool that never sees
  user input and is not shipped (`pnpm audit`, 2026-11-01: 0 high, 0 critical).
- **REST CSRF:** `CsrfHeaderGuard` enforces `X-POS-CSRF: 1` on the upload (API.md §9).
- **e2e sign-ins:** specs that are not about logging in reuse one session per user (`signInOnce`), because the
  whole suite shares one IP and the `login-ip` limit (30 per 15 minutes) stays as it is.

### ADR-041 AI Assistant (Phase 12, 2026-11-01)
- **Model (U-05 default): `openai/gpt-oss-120b`**, overridable with `GROQ_MODEL`.
  - Chosen from Groq's production models on 2026-11-01: it supports tool use, has published pricing
    ($0.15 / $0.60 per million input / output tokens) and handles Urdu. The Llama production models are
    sales-contact only.
  - GPT-OSS calls send `reasoning_effort: low` and `include_reasoning: false`, so no reasoning text is
    transferred. Output is capped at 4,096 tokens.
- **Calls:** 30 s timeout. The SDK's own retries are off; the client retries once on a 5xx only.
  - 401/403 → `AI_NOT_CONFIGURED` ("Groq refused the API key").
  - 429, timeouts and other failures → `AI_UNAVAILABLE`.
  - An empty answer counts as unavailable.
- **One request path (`AiRequestService`):** rate limit `ai` (30 per user per hour; cached answers count;
  fails closed) → decrypt the key → cache lookup → single-flight generation → audit `ai.requested`.
  - The audit row holds feature, language, tokens, tool rounds, latency and whether the answer was cached;
    never the prompt, the answer or the key.
  - The cache key hashes feature, inputs, language, business date and model.
- **Data (`AiFactsService`, from `reporting`):** totals with the previous period of the same length, a daily
  series (weekly beyond 31 days), payment methods, top and slowest 10, velocity rows (≤ 50), slow stock
  (≤ 30), low stock (≤ 20), inventory value and total customer dues.
  - Only product names and numbers are sent: no ids, no customer names or phones (Q17b, checked by SEC-12).
  - Purchase and discount windows are the Q38 defaults.
- **Chat:** five read-only tools whose arguments are checked by `aiToolArgsSchemas`. Unknown tools and
  out-of-bounds arguments go back to the model as errors; they are never executed. After three tool rounds
  the model must answer (`tool_choice: none`).
- **Key (F-30):** AES-256-GCM via `SecretBox`. A new CHECK keeps the ciphertext and `last4` set or cleared
  together.
  - `aiKeyConfigured` and `aiKeyLast4` are field resolvers guarded by `settings:write` (SEC-03), outside
    the cached profile.
  - Setting or clearing the key emits `settings.changed`, which refetches `ShopSettings` and `AiKeyStatus`.
- **Web:** the answer Markdown is rendered with `react-markdown` (`skipHtml`; `a` and `img` unwrapped) and
  Urdu answers are `dir="rtl"`. Results are not stored in the Apollo cache.
  - Business reports print on A4 through a named `@page report` beside the 80 mm receipt page.
- **DateTime fields need Date values:** `GraphQLISODateTime` serialises a string as `null`. This also
  affected `ShopSettings.updatedAt` (served from the cache as text) since Phase 7. It is now a field resolver
  and covered by `settings-events.int.spec`.

### ADR-042 Network verification and its fixes (Phase 14, 2026-11-01)
- **Tools:**
  - `tools/perf` drives the built API with the web app's own generated documents. Apollo-style
    `__typename` is added, so payload sizes are the real ones.
  - It runs on a seeded dataset at full size, behind a byte-counting PostgreSQL proxy, with the live
    channels open.
  - It checks `budgets.json` (§4.1–§4.3), writes `perf-report/`, and runs nightly in
    `network-budgets.yml`.
  - Browser transfer and idleness are measured by `e2e/tests/network.spec.ts` (CDP byte counts, and a fake
    clock fast-forwarded 2 minutes).
- **No link prefetch in the admin shell.** Next.js prefetched every sidebar route on each page load: RSC
  payloads (51–55 KB per repeat visit) and those routes' JS (the first admin page loaded 481 KB of JS,
  including the AI Markdown renderer). Sidebar, overview-tile and terminal admin links use
  `prefetch={false}`, so a section is fetched once, when it is first opened.
- **First-load JS budget tuned with evidence:** 300 KB → 410 KB (compressed), as NETWORK_OPTIMIZATION.md §4
  intends for Phase 14.
  - Measured 363–381 KB. React and Next.js ≈ 160 KB, Apollo and graphql 43 KB, Zod 31 KB, all GraphQL
    documents 27.5 KB, Radix 19 KB, then app code.
  - It loads once per release per device, from the CDN, with immutable caching. It is not Neon transfer.
- **Order history rows** select only their columns (`OrderRowFields`), plus `refundedTotal` and `version`,
  which the live `order.refunded` patch needs: 22.3 KB → 17.3 KB a page. A first version without them stopped
  open lists from showing refunds (caught by E2E-04; now also a unit test).
- **Result:** 63.6–63.8 MB of database transfer a month at 1,500 bills, against a 300 MB target and a 1 GB
  ceiling (the old system: 6–7 GB).

### ADR-043 Security review and operations without platforms (Phase 15, local part, 2026-11-01)
- **Scope:** everything Phase 15 can do before the owner picks hosts and accounts (U-01–U-04, U-06, U-07).
  Deploying, staging checks (STG-01–STG-04), alert test fires and the restore drill wait for those decisions;
  `docs/runbooks/first-deploy.md` is the checklist for them.
- **Authorization matrix (SEC-02):** `authorization-matrix.int.spec.ts` reads every Query and Mutation from
  the served schema and the access policy from its resolver. It calls each one as anonymous, cashier and admin
  with the smallest well-typed arguments, selecting only `__typename`, and checks that exactly the excluded
  callers get `UNAUTHENTICATED`/`FORBIDDEN`. A new operation is covered without editing the test.
  `logout` is checked for anonymous only, so the matrix keeps its sessions. Login's generic credential error
  is told apart by its message.
- **CORS:** `origin` is now a one-item list. With a string, the `cors` middleware sent the web origin to
  every caller: browsers still blocked other sites, but SEC-07 requires no CORS headers for them.
- **Monitoring metrics** that DEPLOYMENT.md §8 alerts on now exist:
  - `pos_graphql_duration_seconds` (an Apollo plugin; labels are the operation name and ok/error only,
    capped at 200 names);
  - `pos_ws_connections`.
- **Secret handling CLIs:**
  - `cli:rotate-settings-key` re-encrypts the Groq key under a new `SETTINGS_ENCRYPTION_KEY`: one
    transaction, the row locked, idempotent, audited as `settings.aiKeyReencrypted`.
  - `cli:revoke-all-sessions --confirm` reuses `SessionRevocationService` with a new "everyone" target, so
    cached sessions get tombstones and every socket closes with 4401.
  - `SecretBox` now delegates to pure `sealSecret`/`openSecret` functions.
- **Error tracking (Sentry) is not wired** until U-07 picks the tool and account; unexpected errors are
  logged with their `requestId` meanwhile.
- **Backups:** `.github/workflows/backup.yml` (pg_dump 17 → age → R2, read back and compared, newest 12
  kept). Not run yet: it needs the production secrets.

---

## Upstash Redis configuration (2026-11-01)

The owner selected an Upstash Mumbai Redis instance. The API uses its TLS Redis protocol URL; REST URLs and
REST tokens are not substitutes. Observed network round trips of around 200 ms exceeded the cache client's
original timeout; the owner approved raising it to 1 second, increasing failure-detection latency. TLS PING
and the rate-limit Lua script passed against Upstash; Pub/Sub, BullMQ, connection limits and no-eviction remain
unverified, so production selection remains conditional on those checks.

## Neon development database update (2026-11-01)

The owner chose Neon for development and production, on separate branches. Before initialization and after
confirming no prior new-app databases needed preservation, the temporary full bill-number index was removed
from the sales migration and the following migration was changed to create the final partial index directly.
The empty development database was initialized without a destructive `DROP`; future migrations are forward-only.

## Account sign-up update (2026-11-01)

The owner replaced D-10's no-sign-up policy with sign-up using one server-side shared key and a choice of
Admin or Cashier. Anyone holding the key can create an Admin; treat it as a privileged secret, rotate it if
exposed, and keep it out of source control. Existing admin staff management remains available.

## 3. Unresolved decisions (owner input needed; defaults apply until answered)

| ID | Decision | Proposed default | Affects |
|---|---|---|---|
| U-01 | API + Redis host | Railway (ADR-022) | DEPLOYMENT |
| U-02 | Vercel plan for commercial use, or host web on Railway too | Vercel Pro; Railway as fallback | DEPLOYMENT, cost |
| U-03 | Domain for `pos.` and `api.` subdomains (needed for same-site cookies) | Owner buys/uses a domain | Auth, DEPLOYMENT |
| U-04 | Neon plan, region, autosuspend, PITR window | Paid plan, autosuspend off in production, ≥ 7-day PITR | DATABASE.md §10 |
| U-05 | Groq model | `openai/gpt-oss-120b` (ADR-041); change with `GROQ_MODEL` without a release | AI |
| U-06 | Off-site backup bucket (Backblaze B2 / Cloudflare R2) | Cloudflare R2 | DEPLOYMENT.md §7 |
| U-07 | Error and uptime tooling accounts (Sentry, Better Stack) | Free tiers | DEPLOYMENT.md §8 |

Business questions (Q6b–Q35, A-06–A-08) are tracked in [FEATURES.md §6](FEATURES.md).
