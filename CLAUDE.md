# CLAUDE.md — Stationery POS Cloud

## Project

A cloud replacement for the "BrandWings Business Hub" stationery point of sale: one shop, two or more
billing counters, Admin and Cashier roles. It covers billing with receipts (80 mm), refunds, products,
categories and stock, low-stock alerts, customer and vendor khata (credit ledgers), a dashboard, product
import/export, and an AI assistant (Groq). The old app's Neon database transfer of 6–7 GB/month (D-02) is the
problem this rebuild must fix without losing features or financial correctness.

**Current status:** implementation in progress under the owner's feature-by-feature instruction, following
[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) phase by phase, in the owner's batches (1+2 realtime and
catalogue, 3+4 khata and billing, 5+6 dashboard and import/export, 7 AI). Phases 1–12 and 14 are done; Phase 15's
local part is done (deployment waits for the owner's U-01–U-07), and Phase 13 (legacy migration) waits for the old
schema (Q27). The progress ledger (§4) and FEATURES.md §8 are the source of truth for what comes next.

## Stack (details and versions: [DECISIONS.md](DECISIONS.md))

pnpm workspaces + Turborepo · Next.js App Router, React, TypeScript strict · Apollo Client + GraphQL Codegen ·
Tailwind + shadcn/ui · React Hook Form + Zod · NestJS + Apollo Server (code-first GraphQL) · `graphql-ws`
subscriptions · Prisma ORM · PostgreSQL on Neon · **Redis (mandatory)** for cache, rate limits, Pub/Sub fan-out
and BullMQ · Vitest (integration tests on real Postgres + Redis), Playwright · Vercel (web), Railway (API + Redis).

## Non-negotiable rules

1. **No polling, ever.** No `setInterval`, `pollInterval`, `startPolling`, periodic refetch or timer loops.
   Live data comes from the single `shopEvents` subscription; recovery refetches active queries only.
2. **Every list is backend-paginated:** `first` default 50, max 50, keyset cursors. Never download a whole
   table to page or filter it in the browser. Totals are SQL aggregates over complete data.
3. **No handwritten source file over 200 lines** (target 100–150), blank lines and comments included. Split by
   responsibility.
4. **No duplicate logic.** Each concern has one home (REPOSITORY_STRUCTURE.md §4). Money, bill and refund
   maths live only in `@pos/domain`. Validation lives only in `@pos/validation`.
5. **PostgreSQL is the only source of truth.** Redis never holds a record that isn't in Postgres, never caches
   stock, prices for billing, orders or ledgers, and a Redis failure must never fail a sale.
6. **Financial correctness first:** server-side calculation from locked rows, `expectedTotal` check,
   idempotency keys, row locks in ascending id order, DB `CHECK` constraints, archive instead of delete
   for anything a bill or khata entry depends on (D-12, D-28).
7. **Authorization on the server** for every resolver (`@RequirePermission`/`@Public`), with no exceptions.
8. **Don't invent business rules.** Use FEATURES.md decisions (D-xx) and documented defaults (Q-xx). Record new
   questions there.
9. **Minimal transfer:** explicit Prisma `select` everywhere (including updates), small fragments, events of
   1 KB or less.
10. **No secrets or PII** in code, docs, logs, events, AI prompts or test fixtures.

## Workflow

1. Read the phase in IMPLEMENTATION_PLAN.md and the relevant feature ids in FEATURES.md.
2. Search for existing implementations before writing anything new.
3. Build vertical slices; follow [INSTRUCTIONS.md](INSTRUCTIONS.md) recipes.
4. Update affected docs in the same change; record decisions in DECISIONS.md.
5. Run the quality gates; never weaken a check, disable a lint rule or suppress a type error to pass.
6. Update the progress ledger (IMPLEMENTATION_PLAN.md §4) and report to the owner.

**Never:** commit, push or deploy unless asked; run `prisma db push`, `migrate reset` or destructive SQL
against anything but local Docker; modify `Screen Shots/` or the old system; mark untested work as done.

## Quality gates

Run with Node 24 LTS on `PATH` (`node --version` must print v24). The scripts exist from Phase 1.

```
pnpm verify              # format, lint, typecheck, file-size, duplication, deps, no-polling,
                         # pagination, unit tests, build, schema drift
pnpm check:secrets       # gitleaks (binary must be on PATH)
pnpm services:up         # start local Postgres + Redis before integration/e2e tests
pnpm test:integration    # real Postgres + Redis (TEST_DATABASE_URL / TEST_REDIS_URL)
pnpm test:e2e            # Playwright
pnpm dev | build | lint | typecheck | test | codegen | schema:emit
pnpm services:up | db:migrate | db:seed     # local services (Docker or WSL); never remote DBs
```

## Documents

| Need | Document |
|---|---|
| What the old app does, owner decisions, open questions | [FEATURES.md](FEATURES.md), [docs/EXISTING_SYSTEM_AUDIT.md](docs/EXISTING_SYSTEM_AUDIT.md) |
| Why each technology/design was chosen; unresolved decisions | [DECISIONS.md](DECISIONS.md) |
| Components, topology, module graph, rendering strategy | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Every folder and file, and what belongs where | [REPOSITORY_STRUCTURE.md](REPOSITORY_STRUCTURE.md) |
| Flows: auth, billing, refunds, realtime, Redis, AI, failures | [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md) |
| Tables, constraints, indexes, transactions, migrations, backups | [DATABASE.md](DATABASE.md) |
| GraphQL/WS/REST contract, pagination, errors, events, rate limits | [API.md](API.md) |
| Metrics, budgets, cache policies, measurement | [NETWORK_OPTIMIZATION.md](NETWORK_OPTIMIZATION.md) |
| How to write code here | [INSTRUCTIONS.md](INSTRUCTIONS.md) |
| Enforced rules and CI checks | [CODING_STANDARDS.md](CODING_STANDARDS.md) |
| Test strategy and test ids | [TESTING.md](TESTING.md) |
| Environments, env vars, Redis, releases, backups, DR, cutover | [DEPLOYMENT.md](DEPLOYMENT.md) |
| Phases, acceptance criteria, progress ledger | [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) |
