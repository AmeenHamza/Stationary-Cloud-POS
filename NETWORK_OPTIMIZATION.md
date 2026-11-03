# NETWORK_OPTIMIZATION.md — Measurement, Budgets and Optimization Plan

**Status:** Proposed, awaiting owner review (design stage). **No measurements exist yet** for either system,
except the owner-reported Neon figure. Every number below is a budget (a target to enforce) or derived
arithmetic, clearly labelled.
**Last updated:** 2026-10-28
**Related:** [docs/EXISTING_SYSTEM_AUDIT.md §4](docs/EXISTING_SYSTEM_AUDIT.md) (hypotheses H1–H7) ·
[SYSTEM_DESIGN.md](SYSTEM_DESIGN.md) · [TESTING.md §8](TESTING.md)

---

## 1. Metrics: what is measured and where

Different links cost different things. They are **never added together** into one number.

| ID | Link | What it measures | Why it matters | How it is measured |
|---|---|---|---|---|
| **M1** | Postgres (Neon) → API | Bytes sent by Postgres (Neon "network transfer", egress) | **Primary budget.** This is what hit the 5.5 GB limit (D-02) | Locally: `tools/perf/src/measure/pg-byte-proxy.ts` (a TCP proxy counting server→client bytes). Production: Neon usage dashboard |
| M2 | Browser ↔ API, HTTP | GraphQL and REST request/response bytes, compressed (on the wire) and uncompressed (payload) | Shop internet data and speed | Playwright + Chrome DevTools Protocol (`encodedDataLength`, `dataLength`) |
| M3 | Browser ↔ API, WebSocket | Frame payload bytes sent and received per session | Idle cost of being live | CDP `Network.webSocketFrameSent/Received` |
| M4 | Browser ↔ Vercel | HTML, JS, CSS and font bytes; first and repeat visits | Load time, data use | CDP, cold and warm cache |
| M5 | API ↔ Redis | Commands/s, bytes in/out (`INFO stats`) | Internal health only. Private network, not billed per GB, **not browser traffic** | `tools/perf/src/measure/redis-stats.ts`; production metrics |
| M6 | API → Groq | Request/response bytes, tokens | AI cost | API logs (`ai.requested` audit metadata) |

Each M2 result is reported twice: on-the-wire (compressed) and payload (uncompressed). Budgets name which
one they constrain.

---

## 2. Baseline of the old system

| Fact | Source | Status |
|---|---|---|
| Neon transfer ≈ 6–7 GB per month, reaching the 5.5 GB plan limit | Owner (D-02) | Reported, not measured by us |
| Bills ≈ 500–600 per month | Owner | Uncertain: one day reached `ORD-20261028-049` |
| ≈ 10–14 MB of Neon transfer per bill | Arithmetic from the two rows above | **Derived, not measured** |
| Per-workflow, browser, WebSocket figures | — | **Unknown.** Old code is unavailable (D-01) |

Likely causes (H1–H7 in the audit): dashboard totals computed from raw rows, whole-table reads for badges
and tiles, full catalogue on the terminal, background refresh, unpaginated lists, AI reads, exports.

**Optional evidence the owner can collect** (no code or data leaves their control), to be recorded here
before cutover:

| Measurement | Result |
|---|---|
| Neon daily transfer, last 30 days (busy day vs. quiet day vs. no-sales day) | _not yet collected_ |
| `pg_stat_statements` top 20 by `rows` and by `calls` (normalized query text only) | _not yet collected_ |
| Neon transfer during 30 minutes of idle admin page + terminal | _not yet collected_ |

---

## 3. Targets

**Goal:** the new system's monthly Neon transfer stays well below the plan limit for 1,500 bills a month (the
pace observed on 2026-10-28). The **target is ≤ 300 MB a month**, and **1 GB a month is a hard ceiling**.
Both are hypotheses to be proven by the §8 workload before go-live and by Neon usage after go-live.
No saving is claimed until measured.

---

## 4. Budgets (enforced by tests; proposed values, tuned once in Phase 14 with evidence)

### 4.1 Database transfer (M1)

| Budget | Value |
|---|---|
| One scan-based bill, 3 lines (3 barcode lookups + `createSale`) | ≤ 25 KB |
| One search-based bill, 3 lines (6 searches + `createSale`) | ≤ 80 KB |
| Amortized per bill over the simulated day, including admin screens | ≤ 150 KB |
| Simulated idle hour (all screens open, no actions) | ≤ 10 KB |
| Month at 1,500 bills (simulation × 30) | ≤ 300 MB target · 1 GB ceiling |

### 4.2 GraphQL payloads (M2, uncompressed unless noted)

| Operation | Budget |
|---|---|
| `productByBarcode` | ≤ 1.5 KB |
| `products` page of 50 terminal tiles | ≤ 15 KB (≤ 5 KB compressed) |
| `products` page of 50 admin rows | ≤ 25 KB |
| `createSale` response (3 lines, with receipt) | ≤ 6 KB |
| `orders` page of 50 | ≤ 20 KB |
| `customerLedger` page of 50 | ≤ 15 KB |
| `DashboardLive` / `DashboardHistory` queries | ≤ 3 KB / ≤ 8 KB |
| AI request to Groq (M6): system prompt + one JSON data message | ≤ 12 KB at the row bounds (≤ 50 rows per list); answers ≤ 4,096 tokens, no reasoning text |
| Any mutation request body | ≤ 8 KB (≤ 100 sale lines) |

### 4.3 WebSocket (M3)

| Budget | Value |
|---|---|
| Single event payload | ≤ 1 KB (typical 200–400 B) |
| Idle session (pings only) | ≤ 1 KB/min |
| Events per sale received by another counter | ≤ 3 |

### 4.4 Static assets and requests (M4, request counts)

| Budget | Value |
|---|---|
| `/terminal` cold load, total transferred | ≤ 450 KB |
| First-load JS for `/terminal` and admin list routes (compressed) | ≤ 410 KB (tuned in Phase 14: 363–381 KB measured; the first proposal was 300 KB, ADR-042) |
| `/dashboard` additional chart chunk (lazy) | ≤ 120 KB |
| Repeat visit (all hashed assets cached) | ≤ 30 KB |
| HTTP requests while idle on any screen for 10 min | **0** |
| HTTP requests for a 3-line scan-based bill | ≤ 4 (3 lookups + 1 mutation; receipt needs none) |
| Requests on reconnect | ≤ (active queries) + 1 |

---

## 5. Optimization strategies

### 5.1 Mapping to the old system's likely causes

| Old cause | New design |
|---|---|
| H1 dashboard maths in app code | SQL aggregates (TypedSQL), split into `DashboardLive` and `DashboardHistory`; only Live refetches after sales, coalesced |
| H2 whole product table for badges/tiles | `lowStockCount` uses a partial index `COUNT`; inventory value is one `SUM` row; badge updates by event |
| H3 full catalogue on the terminal | Server-searched, 50-row keyset pages; barcode exact lookup; Apollo cache reused across screens |
| H4 background refresh | Banned. One subscription with tiny events; aggregate refetch only on relevant events |
| H5 unpaginated lists / N+1 | Connections everywhere (max 50); DataLoader for `Product.category` and `Order.cashier`; repository `select` projections |
| H6 AI reads | Bounded aggregates (≤ 50 rows); 15-min Redis cache |
| H7 exports | Explicit, rate-limited, keyset-batched, only exported columns |

### 5.2 Techniques

| Technique | Rule |
|---|---|
| Field selection | Operations use shared fragments sized to the view (`ProductTileFields` ≠ `ProductRowFields`). Admin-only fields (cost price) never appear in terminal fragments |
| Projections | Every Prisma call passes `select`, **including `update`** (otherwise Postgres returns every column). `check-prisma-take.ts` and review enforce it |
| Pagination | `first ≤ 50`, `LIMIT first + 1`; `totalCount` only when the UI shows "of N" |
| Aggregates | Always SQL `GROUP BY`/`SUM`/`COUNT`; never fetch rows to add them up |
| Batching | DataLoader per request for relations; `createMany` for lines and movements; one `UPDATE … RETURNING` per product |
| Request deduplication | Apollo `queryDeduplication` (on by default); identical in-flight queries share one request |
| Cache reuse | Normalized cache plus `cache-first` for reference data; navigation back to a list costs 0 requests unless reconciliation evicted it |
| Search | 250 ms debounce, min 2 chars, abort previous request on new input (`AbortController` via Apollo context) |
| Compression | API: `compression` middleware (gzip/brotli, threshold 1 KB). Vercel: brotli for static assets |
| Static caching | Hashed assets `Cache-Control: public, max-age=31536000, immutable`; HTML shells revalidated |
| Code splitting | Route-level by App Router; charts via `next/dynamic` on the dashboard only; AI Markdown renderer only on AI routes; Urdu font only where Urdu text renders |
| Small events | ids, versions and changed scalars only (API.md §7) |
| Targeted recovery | Active queries + cart ids only (SYSTEM_DESIGN.md §5.5) |
| Fewer re-renders | Screens read narrow fragments; cart context split into state and dispatch contexts; memoized row components in tables |
| Persisted queries | **Not adopted in v1.** Request bodies are small (≤ 2 KB typical) and trusted documents would couple web and API deploys. Revisit if M2 upstream bytes become material |

---

## 6. Client cache policy (Apollo)

| Data | `fetchPolicy` (first mount) | Kept fresh by | Notes |
|---|---|---|---|
| `me`, `shopSettings` | `cache-first` | `settings.changed`, logout | Fetched once per app load |
| `categories` | `cache-first` | `category.changed`, `catalog.bulkChanged` | |
| `products` (terminal, admin), `productByBarcode` | `cache-first` | `stock.changed`, `product.changed` | Reconcile evicts list fields after a disconnect |
| `lowStockCount`, `lowStockProducts` | `cache-first` | `lowStock.countChanged` (coalesced refetch) | |
| `orders`, `customerLedger`, `vendorLedger` | `cache-and-network` | `order.*`, `*.balanceChanged` | Financial lists re-validate once per screen visit (user navigation), never on timers |
| `order(id)` in refund dialog | `network-only` | — | Refundable quantities must be current when the dialog opens |
| `DashboardLive` | `cache-and-network` | `order.created`, `order.refunded` (coalesced) | |
| `DashboardHistory` | `cache-first` | none (closed periods) | |
| AI | n/a (mutations) | — | Redis-cached server-side |

`pollInterval`, `startPolling`, `notifyOnNetworkStatusChange`-driven loops and `refetchQueries` on timers
are banned (CODING_STANDARDS.md §6).

## 7. Server cache (Redis)

Only stable, read-heavy data is cached: session principals, the categories first page, settings, AI results.
Stock, prices used for billing, orders, ledgers and product lists are **never** cached. Keys, TTLs and
invalidation: SYSTEM_DESIGN.md §6.2–6.4. Caching sessions and reference data removes a Postgres read from
most requests, which directly reduces M1.

---

## 8. Measurement methodology (reproducible)

### 8.1 Dataset (`tools/perf/src/dataset/generate-dataset.ts`, fixed seed)
2,345 products in 22 categories (name lengths and Urdu names sampled to match the screenshots), 300
customers, 60 vendors, 12 months of history at 50 bills/day (≈ 18,000 orders, ≈ 58,000 lines), refunds on
2 % of bills, and khata entries for 5 % of bills.

### 8.2 Workload (`tools/perf/src/scenarios/day-simulation.ts`)
A simulated trading day: 2 counters with 25 bills each (1,500/month pace), plus a 10-bill variant (600/month).
Average 3.2 lines per bill; 40 % scanned, 60 % searched (2 searches per line); 5 % Udhaar; 2 % refunds; 3
restocks. The admin opens the dashboard 5×, order history 5×, khata 10×, low stock 3×. Every screen also
sits idle for 10 hours with sockets connected.

### 8.3 Procedure
`pnpm build`, `pnpm services:up`, then `pnpm --filter @pos/perf perf` (`--keep-db` keeps the `perf_*`
database). The browser meters (M2–M4 per route) are `e2e/tests/network.spec.ts`. The original procedure:

1. `docker compose -f infra/docker-compose.yml up` (pinned Postgres and Redis images); production builds of
   API and web.
2. Route the API's database connection through `pg-byte-proxy` (M1); attach the CDP meters (M2–M4);
   snapshot Redis `INFO` before and after (M5).
3. Run the scenario through Playwright (browser flows) and the `graphql-ws` Node client (extra counters).
4. Output `perf-report.json` and a Markdown summary with per-workflow bytes (compressed and uncompressed),
   request counts, DB bytes per bill, p50/p95 GraphQL latency, query counts (from Prisma query events), API
   CPU and memory.
5. `budget-check.ts` compares against `tools/perf/budgets.json`; any budget exceeded by more than 10 %
   fails the run.

Reproducibility: fixed dataset seed, pinned images and lockfile, the same CI runner class, three runs with
the median reported.

### 8.4 Regression checks

| When | Check |
|---|---|
| Every PR | Response-size snapshot tests for the operations in §4.2 (integration tests assert byte length ≤ budget); `idle-no-polling.spec.ts` (0 requests in 2 min idle); bundle budget check from `next build` output |
| Nightly + manual (`network-budgets.yml`) | Full §8 workload with all budgets |
| After go-live | Weekly review of Neon daily transfer against the model; investigate any day above 2× the modelled daily figure |

---

## 9. Results (filled in during Phase 14 and after go-live)

| Metric | Old system | New system (simulation) | New system (production) |
|---|---|---|---|
| Neon transfer per month | ≈ 6–7 GB (owner) | ≈ 64 MB at 1,500 bills (63.6–63.8 MB over three runs, 2026-11-01) | _after go-live_ |
| Neon transfer per bill (amortized) | ≈ 10–14 MB (derived) | 43.3 KB | _after go-live_ |
| Terminal cold load | unknown | 400.9 KB (381.4 KB JS) | _after go-live_ |
| Idle HTTP requests / 10 min | unknown | 0 (NET-04, 2 min with every timer fired) | _after go-live_ |

**Phase 14 measurements (2026-11-01, local PostgreSQL 17 and Redis 8, `tools/perf` and `network.spec.ts`):**

KB = 1,024 bytes and MB = 1,048,576 bytes throughout.

- **Day simulation (NET-06).** Dataset: 2,345 products, 300 customers, 60 vendors and 18,250 history bills
  with 58,931 lines (§8.1). The day: 50 bills with 162 lines, 1 refund, 3 restocks, 23 admin visits, then
  60 s of measured idleness. Two runs gave the same figures within 0.02 %.

| Measurement | Budget | Result |
|---|---|---|
| **Database transfer per month at 1,500 bills** (day × 30, 10 idle hours a day) | ≤ 300 MB target, 1 GB ceiling | **63.6–63.8 MB** (2.1 MB a day) |
| Database bytes per bill, everything included (opening, admin screens, events) | ≤ 150 KB | 43.3 KB |
| 3-line bill by scanning (3 lookups + sale) | ≤ 25 KB | 19.9 KB |
| 3-line bill by searching (6 searches + sale) | ≤ 80 KB | 37.5 KB |
| Idle hour, every screen open | ≤ 10 KB | 1.5 KB (25 bytes in 60 s: no polling) |
| Largest live event · idle socket traffic · events per bill per tab | ≤ 1 KB · ≤ 1 KB/min · ≤ 3 | 749 B · 0 B/min · 1.51 |
| Largest responses: `ProductByBarcode`, `TerminalProducts` page, `CreateSale`, `Orders` page, `DashboardLive`, `DashboardHistory`, `LowStockProducts` page | §4.2 | 354 B, 14.7 KB, 2.0 KB, 17.3 KB, 757 B, 3.1 KB, 22.6 KB: all within |
| HTTP requests per bill (counters) | — | 6.46 (searching dominates: 2 searches per searched line) |

Database bytes per request (averages): `TerminalProducts` 3.9 KB, `ProductByBarcode` 1.9 KB, `CreateSale`
14.2 KB, `RefundOrder` 23.8 KB, `DashboardLive` 3.7 KB, admin `Orders` 14.6 KB, `LowStockProducts` 18.5 KB,
`Customers` (admin, with balances) 10.0 KB.

- **Browser (NET-04, NET-05).**
  - NET-04: the terminal, overview, low stock and orders screens send **0 API requests** while idle for 2
    minutes (the fake clock fires every timer due). Only `ping`/`pong` cross the socket.
  - NET-05, cold load (compressed, headers included):
    - `/terminal`: 400.9 KB in total, of which 381.4 KB is JS.
    - `/products`: 381.1 KB, JS 362.6 KB.
    - `/orders`: 382.8 KB, JS 365.3 KB.
    - `/dashboard` with its chart chunk: 390.1 KB, JS 368.2 KB.
  - NET-05, repeat visits: 4.5–8.9 KB, with no JS (hashed chunks cached).

**Fixed during Phase 14:**
- Admin screens prefetched every sidebar route: 51–55 KB of RSC payloads on each repeat visit, and other
  routes' JS on the first (481 KB of JS). The links no longer prefetch (ADR-042).
- The order history page was 22.3 KB against its 20 KB budget. It now selects only the columns it shows,
  plus `refundedTotal` and `version` for the live refund patch (17.3 KB).

**Still open (measured, all within budget):**
- Every route ships all GraphQL documents (27.5 KB compressed). Codegen's `graphql()` looks documents up in
  one map; importing documents by name would remove this.
- Each scan reads the category name in a second statement, and `createSale` re-reads the order after
  inserting it.

**Early measurements (integration tests, local PostgreSQL through a byte-counting proxy, both directions):**

| Measurement (test) | Budget | Result |
|---|---|---|
| Barcode lookup response, admin fields (NET-01) | ≤ 1.5 KB | PASS (495 B, 2026-10-31) |
| 50 admin product rows (NET-01) | ≤ 25 KB | PASS (24,739 B) |
| DB bytes, scan-based 3-line bill: 3 lookups + `createSale` (NET-03) | ≤ 25 KB | PASS (≈ 18.8 KB: 3 × 1.7 KB scans + 13.6 KB sale, 17 statements). The first measurement was 29.5 KB: stock was updated one product at a time (UPDATE, re-read with category, movement INSERT per line, 12 statements for 3 lines); it is now one UPDATE and one INSERT per bill |
| `createSale` response with its receipt, 3 lines | ≤ 6 KB | PASS (`sales-budgets.int.spec.ts`) |
| `DashboardLive` response and statements (`reporting-dashboard.int.spec.ts`) | ≤ 3 KB | PASS: ≤ 3 KB in ≤ 5 SQL statements |
| `DashboardHistory` response | ≤ 8 KB | PASS |
| Product export of 10,000 rows (`catalog-io-export.int.spec.ts`) | bounded reads | PASS: streamed (chunked), 2 statements per batch of 500 |
| AI requests to Groq, all six features × 3 languages (`ai-assistant.int.spec.ts`, small data) | ≤ 8 KB each | PASS: 0.9–2.3 KB of messages per request (2026-11-01); a repeat within 15 minutes is served from Redis with no Groq call |

Both items noted here in Phase 9 (the scan's second statement, `createSale` re-reading the order) remain
open and are listed under "Still open" above.
