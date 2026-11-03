# TESTING.md — Test Strategy and Test Catalog

**Status:** Proposed, awaiting owner review (design stage). **No tests exist or have run.** Test ids below are
requirements that implementation phases must satisfy (IMPLEMENTATION_PLAN.md).
**Last updated:** 2026-10-28

---

## 1. Strategy

| Level | Tool | Scope | Runs |
|---|---|---|---|
| Unit | Vitest (API via `unplugin-swc`) | `@pos/domain`, `@pos/validation`, API services with fakes, web hooks, reducers, handlers | Every PR |
| Integration | Vitest + real Postgres/Redis (WSL locally, service containers in CI) + supertest + `graphql-ws` client | Resolvers → DB/Redis, transactions, concurrency, realtime, Redis failure, security | Every PR |
| End-to-end | Playwright (Chromium) against production builds on real Postgres/Redis: `e2e/scripts/start-api.ts` creates a fresh `e2e_*` database with fixture accounts and starts the built API on port 4100; the web is built into `.next-e2e` for that API and served on 3100 (clear of development servers) | Critical workflows, two counters, reconnect, offline, no-polling | PRs to `main` |
| Network/performance | `tools/perf` + Playwright CDP + `pg-byte-proxy` | Budgets (NETWORK_OPTIMIZATION.md §4) | Nightly + manual |
| Staging smoke | Playwright + scripts against staging | Neon pooler, Railway WebSocket edge, Vercel headers | Each staging deploy |

**Principles:** test behaviour, not implementation. Money tests use exact decimal strings. No test sleeps on a
timer to wait for an event; tests await the event, or a promise with a timeout used only as a failure
deadline. No real customer data: factories generate fake names and phone numbers.

---

## 2. Infrastructure and isolation

- **Services:** integration tests use a real PostgreSQL 17 and Redis 8 given by `TEST_DATABASE_URL` and
  `TEST_REDIS_URL`. Locally these are the WSL services started by `pnpm services:up` (the development PC has
  no Docker); in CI they are GitHub Actions service containers. Testcontainers is not used.
- **Postgres isolation:** the API's global setup (`test/support/global-setup.ts`) applies all migrations once
  to a randomly named template (`api_tpl_<hex>`); each test file clones it (`CREATE DATABASE api_<hex>
  TEMPLATE …`) and drops it afterwards. `@pos/testkit` refuses any non-local URL.
- **Redis isolation:** integration files run one at a time (`fileParallelism: false`, turbo
  `--concurrency=1`). Each file flushes Redis logical DB 15 before it starts. Pub/Sub channels are
  server-wide, so files never share a Redis concurrently.
- **Clock:** application time comes from `ClockService` (faked in tests). Business dates come from DB `now()`;
  date-boundary tests seed `bill_number_counters` rows instead of changing time.
- **Fault injection:** `@pos/testkit` provides an in-process TCP proxy placed between the API and
  Redis/Postgres: `cut()` drops connections and refuses new ones, `stall()` holds traffic (latency), and
  `restore()` resumes. Byte counting per direction is added for NET-03 and `tools/perf` (Phase 14). A test-only
  `FailpointService` (active only when `NODE_ENV=test`) throws at named points (e.g. `after-stock-update`).
- **Support code:** `apps/api/test/support/`: `harness.ts` boots the real `AppModule` on a cloned database with
  Redis and Postgres behind proxies (several instances may share one database), `app-factory.ts`,
  `graphql-client.ts`, `channel-listener.ts` (observes Redis channels directly), `services.ts`; later
  `ws-client.ts` and `factories/*.ts`.
- **Timing:** event waits use `within(promise, ms)` (built on `common/time/sleep`), never polling loops. Cache
  semantics tests raise the cache client's 1-second command timeout so cold starts on a slow machine cannot turn
  a write into a miss; RED-06 asserts the production timeout explicitly.
- **Needs services:** integration, e2e and perf tests need PostgreSQL and Redis running. If they are not
  reachable, those suites fail with a clear "start services" message; they are never silently skipped.
  Neon-specific behaviour (PgBouncer pooling, cold starts) cannot be reproduced locally and is covered by
  staging smoke tests (§10).

---

## 3. Financial integrity (FIN)

| ID | Case | Expected |
|---|---|---|
| FIN-01 | Screenshot `#44`: 120.00 + 70.00 + 50.00, Bill GST 18 % | subtotal 240.00, GST 43.20, total **283.20** |
| FIN-02 | D-25: items 1,000.00 with 10 % product tax, Bill GST 18 % | tax 100.00, GST 198.00, total **1,298.00** |
| FIN-03 | D-08: items 1,000.00, 10 % discount, Bill GST 18 % | discount 100.00, GST 162.00, total **1,062.00** |
| FIN-04 | Flat discount 10.00 over lines 33.33 / 33.33 / 33.34 | Allocations sum to exactly 10.00; deterministic remainder placement |
| FIN-05 | Half-up rounding: 12.5 % of 0.20 | 0.03 |
| FIN-06 | Box sale: 2 boxes × 12 pieces at box price 1,000.00 | line 2,000.00; stock −24 pieces; `pieces_per_unit = 12` snapshot |
| FIN-07 | Flat discount > subtotal; percent > 100; box without box price | `BAD_USER_INPUT`; nothing written |
| FIN-08 | Price changed between preview and submit | `PRICE_CHANGED` with quote; no order, stock, counter or outbox change |
| FIN-09 | Same idempotency key sent twice (sequentially and concurrently) | One order; stock decremented once; second response `replayed: true` |
| FIN-10 | Same key, different payload | `IDEMPOTENCY_KEY_REUSED` |
| FIN-11 | 3 clients × 20 parallel sales over 2 overlapping products, lines in opposite orders | No failures after retries; final stock = initial − Σ sold; bill numbers unique and contiguous 001–060; Σ movements = stock |
| FIN-12 | Counter rows: previous date at 049, first sale on a new date | New date starts at `001`; format `ORD-YYYYMMDD-001` |
| FIN-13 | Sale above stock (D-16) | Succeeds; `stockWarnings` lists product; stock negative; product appears in low stock |
| FIN-14 | Udhaar without customer; Udhaar with customer | `CUSTOMER_REQUIRED`; exactly one `CREDIT_SALE` entry, `balance_after` correct |
| FIN-15 | Refund 1 of 3 units, then 2 of 3 | Second refund takes the exact remainder; Σ refunds = line amount; full refund of all lines = order total exactly (GST share remainder included) |
| FIN-16 | Refund of a box line | Restock = quantity × `pieces_per_unit` (D-14) |
| FIN-17 | Refund of an Udhaar bill | `REFUND_CREDIT` of −amount; balance may go negative (advance) (A-03) |
| FIN-18 | Two concurrent refunds of the last unit | One succeeds; the other `REFUND_EXCEEDS_REMAINING`; `refunded_quantity ≤ quantity` |
| FIN-19 | Direct SQL insert of an order whose total ≠ components | Rejected by `CHECK` constraint |
| FIN-20 | Failpoint after the stock update inside `createSale` | Full rollback: no order, lines, movements, counter increment or outbox rows |
| FIN-21 | Two concurrent payments on one khata | Both recorded; `balance_after` values form a consistent chain |
| FIN-22 | Property test: 500 random sales/refunds/restocks/adjustments/khata entries | All DATABASE.md §12 integrity checks pass |
| FIN-23 | Restock/adjust rules | Decrease needs reason; cashier → `FORBIDDEN`; movement sign constraints enforced |
| FIN-24 | `expectedAmount` mismatch on refund | `QUOTE_MISMATCH`; nothing written |

---

## 4. Pagination (PAG)

| ID | Case | Expected |
|---|---|---|
| PAG-01 | No `first` | 50 nodes max |
| PAG-02 | `first: 0`, `first: 51`, `first: 2.5` | `BAD_USER_INPUT` |
| PAG-03 | 120 rows with duplicate sort values, walked page by page | 50 / 50 / 20; no duplicates or gaps |
| PAG-04 | Malformed cursor; cursor from another sort | `BAD_CURSOR` |
| PAG-05 | Filter with no matches | `nodes: []`, `hasNextPage: false`, `endCursor: null` |
| PAG-06 | Rows inserted during traversal | No duplicates in already-walked range |
| PAG-07 | `totalCount` not selected / selected | COUNT query absent / present (query counter) |
| PAG-08 | Orders and ledgers default window | Last 90 days; `includeArchived` returns older rows |
| PAG-09 | Table-driven over **every** connection in `schema.graphql` | PAG-01, 02, 04 hold for each (generated test) |

---

## 5. Security (SEC)

| ID | Case |
|---|---|
| SEC-01 | Reflection test: every Query, Mutation, Subscription and REST handler has permission metadata or `@Public` |
| SEC-02 | Authorization matrix: every operation × {anonymous, cashier, admin} matches API.md §5 (data from `@pos/contracts/permissions.ts`; `authorization-matrix.int.spec.ts`, generated from the served schema) |
| SEC-03 | Field-level: cashier requesting `costPrice`, `aiKeyConfigured` → `FORBIDDEN` for that field |
| SEC-04 | Login: generic error for unknown user and wrong password; rate limit after 5 attempts; unknown users still run argon2 (timing parity within tolerance) |
| SEC-05 | Disabling a user returns `UNAUTHENTICATED` on the next request, and their sockets on **both** instances close with `4401` within 1 s |
| SEC-06 | Cookie: `__Host-` prefix, `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, no `Domain` |
| SEC-07 | CSRF: GraphQL without JSON content type rejected; REST mutation without `X-POS-CSRF` rejected; disallowed origin gets no CORS headers (`http.int.spec`, `catalog-io-import.int.spec`, `authorization-matrix.int.spec`) |
| SEC-08 | WebSocket with a foreign `Origin` → `4403`; without a cookie → `4401` |
| SEC-09 | Depth 11 and complexity > 1,000 rejected; introspection off when `NODE_ENV=production` |
| SEC-10 | Production-mode errors contain no stack, SQL or Prisma messages |
| SEC-11 | The Groq key never appears in any GraphQL response, log line or audit metadata (`ai-assistant.int.spec`: responses, ciphertext, audit, outbox; E2E-14: the e2e API's log file) |
| SEC-12 | Seeded customer names and phones never appear in captured logs, outbox payloads or Sentry test transport; AI prompts captured by the Groq stub carry no customer names, phones or ids (`ai-assistant.int.spec`) |
| SEC-13 | Last-admin guard (`LAST_ADMIN`) |
| SEC-14 | Upload: > 5 MB, wrong magic bytes, > 5,000 rows rejected; export escapes `=,+,-,@` cells |
| SEC-15 | Sign-up requires the configured secret and allows only the specified roles (D-10) |

---

## 6. Real-time and WebSocket (RT)

| ID | Case |
|---|---|
| RT-01 | Table-driven: each use case emits the events in API.md §7.2 with the right audience and payload schema |
| RT-02 | A cashier socket never receives `admin` audience events |
| RT-03 | Two API instances sharing Redis: a sale on A reaches a client on B within 1 s |
| RT-04 | Publisher disabled (crash simulation): rows stay unpublished → instance restart drains → client receives them; a duplicate publish is dropped by the client de-dup |
| RT-05 | 1,000 connect/subscribe/disconnect cycles: Redis channel subscriptions, socket maps and listener counts return to baseline |
| RT-06 | Client reconcile (unit, mocked links): only active queries are refetched, `productsByIds` for the cart, inactive list fields evicted, no `products` query without filters is issued |
| RT-07 | Out-of-order events: an older `version` does not overwrite newer cache data |
| RT-08 | Coalescing: 10 `order.created` events within 1 s → one `DashboardLive` refetch |
| RT-09 | Subscriber reconnect on an instance → `system.resyncRequired` delivered to its sockets |
| RT-10 | Event payload builders produce ≤ 1 KB for the largest allowed input (100 lines) |
| RT-11 | Backoff: `retryWait` delays are within the jitter bounds and capped at 30 s; no retry on `4401`/`4403` |

---

## 7. Redis (RED)

| ID | Case |
|---|---|
| RED-01 | Redis stopped: `createSale`, `refundOrder`, khata payment, restock all succeed; outbox rows remain unpublished |
| RED-02 | Redis restarted: drain publishes pending rows; clients receive events and `resyncRequired` |
| RED-03 | Invalidation: update a category or settings → next read returns the new value (generation bump) |
| RED-04 | Stale-fill race: a slow loader overlaps an invalidation → the stale value is never served |
| RED-05 | Session tombstone vs. stale fill (`NX`) → a revoked session is never served from cache |
| RED-06 | Stalled Redis → cache treated as a miss after the 1-second command timeout; request succeeds |
| RED-07 | Rate limits with Redis down: login limited in memory; sales not limited |
| RED-08 | Upload while Redis is down → job `QUEUED`, enqueued on `ready`, each row applied exactly once |
| RED-09 | `maxmemory` tiny → cache writes fail gracefully; no request fails |
| RED-10 | `/health/ready` returns 200 with `redis: degraded`; `/health/live` touches neither DB nor Redis |
| RED-11 | Cache never contains stock, orders, ledgers or customer fields (key-scan test after an e2e flow) |

---

## 8. Network and bandwidth regression (NET)

| ID | Case | Budget source |
|---|---|---|
| NET-01 | Response byte size per operation (integration) | NETWORK_OPTIMIZATION.md §4.2 |
| NET-02 | Query count per list request ≤ 3 (no N+1) | CODING_STANDARDS.md §9 |
| NET-03 | DB bytes for a scan-based 3-line bill through `pg-byte-proxy` | NETWORK_OPTIMIZATION.md §4.1 |
| NET-04 | e2e idle: 0 HTTP API requests in 2 min on terminal, dashboard, low stock, orders; WS frames are pings only (`network.spec.ts`, fake clock fast-forwarded) | NETWORK_OPTIMIZATION.md §4.4 |
| NET-05 | e2e cold and warm transfer of `/terminal`, `/products`, `/orders`, `/dashboard` (CDP bytes; first-load JS budget) | NETWORK_OPTIMIZATION.md §4.4 |
| NET-06 | Full-day workload (`pnpm --filter @pos/perf perf`, nightly in `network-budgets.yml`): all `budgets.json` budgets, report artifact | NETWORK_OPTIMIZATION.md §8 |
| NET-07 | Requests per scan-based bill ≤ 4 | NETWORK_OPTIMIZATION.md §4.4 |

---

## 9. End-to-end workflows (E2E)

| ID | Workflow |
|---|---|
| E2E-01 | Admin creates a cashier; cashier logs in; sign-up page requires a key |
| E2E-02 | Cash sale with one scan and one search; receipt print invoked (`window.print` stubbed); cart cleared |
| E2E-03 | Udhaar sale with quick-add customer; khata shows the `CREDIT_SALE` entry and balance |
| E2E-04 | Partial then full refund; statuses, stock and receipt totals |
| E2E-05 | Restock and adjustment; admin's low-stock badge updates live |
| E2E-06 | Two counters (two browser contexts): a sale on counter 1 updates the tile on counter 2 without reload |
| E2E-07 | WebSocket blocked → amber banner → restored → reconcile requests ≤ active queries + 1 |
| E2E-08 | `setOffline(true)` during payment → button disabled; online → the pending sale confirms exactly once |
| E2E-09 | Price edited by admin mid-cart → cart preview updates; forced stale case shows the `PRICE_CHANGED` dialog |
| E2E-10 | Products and orders pagination forward and back |
| E2E-11 | Cashier visiting admin routes is redirected; the API denies direct calls |
| E2E-12 | Import with one invalid row: progress, completion, error report download |
| E2E-13 | Dashboard today tiles update after a sale on another counter |
| E2E-14 | The key is saved in Settings, then each AI feature runs against the Groq stub (`@pos/testkit` groq-stub, started by `e2e/scripts/start-api.ts`) in all 3 languages, with Print and the chat |

---

## 10. Other suites

| ID | Case |
|---|---|
| ARCH-01 | Nest module import graph equals ARCHITECTURE.md §7.1 |
| ARCH-02 | Prisma enums equal `@pos/contracts/enums.ts` |
| ARCH-03 | Each GraphQL InputType's fields equal its Zod schema's keys |
| MIG-01 | Legacy dry-run against a fixture DB built from the owner-provided schema (Q27): report counts, duplicates, mismatches |
| MIG-02 | Re-running the migration inserts nothing new (idempotent via `legacy_id`) |
| MIG-03 | Post-run verification totals equal the fixture's totals |
| MIG-04 | Duplicate active barcodes handled per Q35 default |
| MIG-05 | Bill counters continue after the highest migrated number per date |
| STG-01 | Staging: transactions and prepared statements through the Neon pooled endpoint |
| STG-02 | Staging: WebSocket stays connected through the Railway edge for 30 min idle (pings only) |
| STG-03 | Staging: security headers and CSP from Vercel; cookie works across `pos.`/`api.` subdomains (the production builds' headers are checked locally by `e2e/tests/security-headers.spec.ts`) |
| STG-04 | Staging: `prisma migrate deploy` from the pre-deploy command; rollback by redeploying the previous image |

---

## 11. When suites run, and coverage

| Trigger | Suites |
|---|---|
| Local (`pnpm verify`) | Unit, integration (if Docker), static checks, build |
| Pull request | Unit, integration, static checks, build; E2E on PRs to `main` |
| Nightly | NET-06 full workload, E2E, dependency audit |
| Staging deploy | STG-01–STG-04 |
| Before go-live | Everything + MIG suite against the real dry-run report + restore drill (DEPLOYMENT.md §7) |

Coverage thresholds: CODING_STANDARDS.md §10. Flaky tests are quarantined only with an issue link and an
owner, fixed within one phase, and never deleted to make CI green.
