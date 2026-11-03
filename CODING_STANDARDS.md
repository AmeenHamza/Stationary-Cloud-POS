# CODING_STANDARDS.md — Enforceable Rules and Automated Checks

**Status:** Proposed, awaiting owner review (design stage). **None of the scripts or configs below exist yet**; they
are created in Phase 1 (IMPLEMENTATION_PLAN.md) and have never been run.
**Last updated:** 2026-10-28

This document holds rules a machine can check, plus the manual audits that cover what machines cannot.
How-to conventions for each area (GraphQL, WebSocket, Redis, database, errors, testing) are in
[INSTRUCTIONS.md](INSTRUCTIONS.md). The two documents do not repeat each other.

---

## 1. Rule summary

| # | Rule | Enforced by | Blocks merge |
|---|---|---|---|
| R1 | No handwritten source file over 200 lines | `check:file-size` + ESLint `max-lines` | Yes |
| R2 | No duplicated code blocks | `check:duplication` (jscpd) | Yes |
| R3 | Module boundaries and no cycles | `check:deps` (dependency-cruiser) + module-graph test | Yes |
| R4 | Strict TypeScript, no `any`, no suppression | `typecheck` + ESLint | Yes |
| R5 | No application polling | ESLint + `check:no-polling` + idle e2e test | Yes |
| R6 | Backend pagination ≤ 50 on every list | `check:pagination` + PageArgs tests | Yes |
| R7 | Generated GraphQL contract in sync | `check:schema` | Yes |
| R8 | Formatting | `format:check` (Prettier) | Yes |
| R9 | Tests and production builds pass | `test`, `test:integration`, `build`, `test:e2e` | Yes |
| R10 | No secrets, no high/critical vulnerable dependencies | `check:secrets`, `audit:deps` | Yes |
| R11 | Every resolver declares a permission | authz-matrix test (TESTING.md SEC-01) | Yes |

---

## 2. R1 — 200-line source-file limit

**Counting method (identical locally and in CI):** physical lines = the number of `\n` (LF) characters, plus
one if the file is non-empty and does not end with `\n`. **Blank lines and comments count.** `.gitattributes`
forces LF so Windows checkouts count the same. Limit **200** (error); **150** prints a warning (the target is
100–150).

**Counted extensions:** `.ts .tsx .js .jsx .mjs .cjs .css .graphql .prisma .sql .sh`. This covers app code,
tests, scripts, styles, GraphQL documents, Prisma schema files, migration SQL and TypedSQL.

**Excluded (generated, vendored or not code):** `**/node_modules/**`, `**/dist/**`, `**/.next/**`,
`**/.turbo/**`, `**/coverage/**`, `**/__generated__/**`, `packages/database/src/generated/**`,
`packages/contracts/schema.graphql` (emitted), `pnpm-lock.yaml`, `*.md`, `*.json`, `*.yml`/`*.yaml`
(configuration, kept small by convention), `Screen Shots/**`.

**Exceptions:** `scripts/file-size.config.json` → `"exceptions": []`. An entry is allowed **only** for a
generated artifact that cannot live under an excluded path, and it needs `{ "path", "generator", "reason" }`.
CODEOWNERS requires owner approval for any change to that file. Handwritten files never get exceptions.

**Script spec:** `scripts/check-file-size.ts` walks the workspace using the include/exclude globs from the
config file, prints `path: lines` for every file > 150 (warning) and > 200 (error), and exits 1 if any error
exists. ESLint `max-lines: ["error", { max: 200, skipBlankLines: false, skipComments: false }]` gives
in-editor feedback for TS/JS. The script is authoritative and also covers CSS, GraphQL, Prisma and SQL.

**How to split (by responsibility, never arbitrarily):**

| Too big | Split into |
|---|---|
| Service with several use cases | One file per use case (`create-sale.service.ts`, `refund-order.service.ts`) |
| Use case with long pure maths | Move the maths to `@pos/domain` (`billing/discount.ts`, `billing/tax.ts`) |
| Resolver with many operations | One resolver per aggregate (`orders.resolver.ts`, `refunds.resolver.ts`) |
| Repository with many queries | Command vs query repositories (`products.repository.ts`, `product-search.repository.ts`) |
| Screen component | Screen (layout + data hook) + presentational children + a `useXScreen` hook |
| Form | `XFormDialog` (wiring) + `XFormFields` (fields) + schema from `@pos/validation` |
| Prisma schema | One `.prisma` file per domain area |
| Migration | One concern per migration (DATABASE.md §9) |
| Test file | One file per behaviour group; shared setup in `test/support/factories` |

Splitting that creates files with no clear responsibility (e.g. `part2.ts`, `helpers2.ts`) fails review.

---

## 3. R2 — duplicate code

`.jscpd.json`:

```json
{
  "threshold": 0,
  "minLines": 8,
  "minTokens": 70,
  "format": ["typescript", "tsx", "javascript", "graphql", "css"],
  "ignore": ["**/node_modules/**", "**/dist/**", "**/.next/**", "**/__generated__/**",
             "**/generated/**", "**/migrations/**", "packages/contracts/schema.graphql"],
  "gitignore": true,
  "reporters": ["console", "markdown"]
}
```

- `threshold: 0` means any clone of at least 8 lines and 70 tokens fails CI, including in tests (use
  factories in `test/support`).
- `jscpd:ignore` markers are **prohibited**; `check:no-polling` also scans for them.
- Below-threshold duplication of **business logic** is still forbidden. Reviewers check the single-home table
  in REPOSITORY_STRUCTURE.md §4. Examples that must have one implementation: money rounding (`@pos/domain/money`),
  bill/refund maths, low-stock rule, business date, money/date formatting, permission map, pagination
  primitives, cursor codec, Redis key construction (`cache-keys.ts`), event names (`@pos/contracts/events.ts`),
  error codes, GraphQL fragments, Zod schemas, ledger table UI (`components/ledger`).

---

## 4. R3 — module boundaries, imports and cycles

`.dependency-cruiser.cjs` forbidden rules (names are stable; CI prints them):

| Rule | From | To (forbidden) |
|---|---|---|
| `no-circular` | any | any cycle |
| `web-not-to-server` | `^apps/web` | `^apps/api`, `^packages/database`, `^tools` |
| `domain-is-pure` | `^packages/domain` | anything except `decimal.js`, `date-fns`, `@date-fns/tz`, `^packages/contracts` |
| `contracts-is-leaf` | `^packages/contracts` | any npm or workspace package |
| `validation-deps` | `^packages/validation` | anything except `zod`, `^packages/(domain\|contracts)` |
| `database-consumers` | anything **except** `apps/api/src/modules/*/(*/)?persistence/`, `apps/api/src/infrastructure/prisma/`, `apps/api/src/cli/`, `tools/(legacy-migration\|perf)` | `^packages/database` |
| `api-resolvers-no-persistence` | `apps/api/src/modules/**/graphql/` | `**/persistence/**`, `@pos/database`, `ioredis` |
| `api-core-no-modules` | `^apps/api/src/(common\|infrastructure)` | `^apps/api/src/modules` |
| `api-module-public-api` | `modules/<a>/**` | `modules/<b>/**` except `modules/<b>/index.ts` |
| `web-feature-public-api` | `features/<a>/**` | `features/<b>/**` except `features/<b>/index.ts` |
| `web-shared-no-features` | `apps/web/src/(components\|lib\|hooks\|providers)` | `apps/web/src/features` |
| `no-test-imports` | non-test files | `*.spec.ts`, `*.test.ts(x)`, `test/**` |
| `not-to-dev-dependency` | production source | packages in `devDependencies` |

**Module graph test (ARCH-01):** an API unit test reads each Nest module's `imports` metadata and asserts the
graph equals the edges in ARCHITECTURE.md §7.1. A new edge needs that table updated in the same PR.

**Import style:** the web app uses the path alias `@/` for `src/`; the API uses relative imports (one
resolution config cannot map `@/` to two apps, and dependency-cruiser must resolve both); workspace packages by name (`@pos/domain`);
no relative imports climbing out of a module (`../../..` across module roots is caught by the rules above).
Import order: built-ins, external, `@pos/*`, `@/`, relative (ESLint `import-x/order`). Type-only imports use
`import type`.

---

## 5. R4 — TypeScript and lint

`@pos/config-typescript/base.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `useUnknownInCatchVariables`,
`noPropertyAccessFromIndexSignature`, `forceConsistentCasingInFileNames`, `isolatedModules`. The NestJS
preset adds `experimentalDecorators` and `emitDecoratorMetadata`.

ESLint (`@pos/config-eslint`): `typescript-eslint` `strictTypeChecked` + `stylisticTypeChecked`;
React Hooks; Next core-web-vitals (web); plus:

| Rule | Setting |
|---|---|
| `@typescript-eslint/no-explicit-any` | error |
| `@typescript-eslint/no-non-null-assertion` | error |
| `@typescript-eslint/ban-ts-comment` | `ts-ignore`, `ts-nocheck` banned; `ts-expect-error` only in tests, with a ≥ 10-char description |
| `@eslint-community/eslint-comments/require-description`, `no-unlimited-disable` | error. Disabling R1/R4/R5 rules is banned outright |
| `no-console` | error in apps and packages (use the logger); allowed in `scripts/` and `tools/` |
| `max-lines` | 200, counting blanks and comments |
| `complexity` / `max-lines-per-function` | warn at 15 / 80 |
| `no-restricted-syntax` | money: `parseFloat`, `Number()`, `.toFixed()` banned in `packages/domain` and `apps/api/src/modules/{sales,customers,vendors,reporting}`. Raw SQL: `$queryRawUnsafe`, `$executeRawUnsafe` banned everywhere. Time: `new Date()` with no arguments and `Date.now()` banned in `packages/domain` and API `application/` (use `ClockService`) |
| `no-restricted-imports` | `@prisma/client` banned outside `packages/database` (use `@pos/database`); `ioredis` banned outside `apps/api/src/infrastructure` and `apps/api/test`; `lodash` banned (no generic utility grab-bag) |
| `@typescript-eslint/no-extraneous-class` | error, with `allowWithDecorator: true` in the API only: Nest modules are empty classes carrying `@Module`; undecorated empty or static-only classes are still flagged |

---

## 6. R5 — no polling

ESLint (all apps and packages):

```js
'no-restricted-globals': ['error',
  { name: 'setInterval', message: 'Polling is banned (CODING_STANDARDS.md §6).' },
  { name: 'setTimeout',  message: 'Use lib/timing (web) or common/time (api).' }],
'no-restricted-syntax': ['error',
  { selector: "Property[key.name='pollInterval']",               message: 'Apollo polling is banned.' },
  { selector: "CallExpression[callee.property.name='startPolling']", message: 'Apollo polling is banned.' },
  { selector: "Property[key.name='refetchInterval']",            message: 'Periodic refetch is banned.' },
  { selector: "CallExpression[callee.property.name=/^(setInterval|setTimeout)$/]", message: 'Use timing helpers.' }]
```

`setTimeout` is re-allowed by an ESLint override **only** in `apps/web/src/lib/timing/**` (`debounce.ts`,
`sleep.ts`) and `apps/api/src/common/time/**` (`sleep.ts`). These helpers have tests showing they never
schedule repeated fetches.

`scripts/check-no-polling.ts` is a text scan of all source **and** config files, for files ESLint does not see.
It searches for `pollInterval`, `startPolling`, `setInterval`, `refetchInterval`, `refreshInterval`,
`revalidate:` numbers in `fetch` options, `jscpd:ignore`, and `eslint-disable` lines targeting the rules
above. The allow-list is the timing helper files only.

Runtime proof (static checks cannot prove the absence of recursive loops): e2e `idle-no-polling.spec.ts`
opens the terminal, dashboard, low-stock and orders screens, idles for 2 minutes each, and asserts **zero**
HTTP requests to the API and only ping/pong WebSocket frames.

Library audit (defaults that could fetch periodically) is in SYSTEM_DESIGN.md §5.6; it is re-checked on every
major upgrade (Renovate PR checklist).

---

## 7. R6/R7 — pagination and schema

- `scripts/check-graphql-pagination.ts` parses `packages/contracts/schema.graphql` with `graphql`. Every field
  whose type is a list of an object type must either belong to a `*Connection` type (`nodes`) or appear in the
  allow-list `scripts/pagination-allowlist.json` with a `bound` and `reason`. The allow-list mirrors API.md §3
  and needs CODEOWNERS approval to change. Every `*Connection` field must take `first` and `after`.
- `scripts/check-prisma-take.ts` scans `**/persistence/**/*.ts` and `apps/api/src/infrastructure/**` for
  `findMany(` calls without `take:` and without a preceding `// bounded: <reason>` comment (e.g.
  `productsByIds`, ≤ 50 ids), and for single-row writes (`create`, `update`, `upsert`, `delete`) without
  `select:` or `// no-select: <reason>`. Only calls with an object-literal argument are checked, which is
  every Prisma delegate call; `map.delete(key)` and similar are not Prisma.
- `PageArgs` unit tests (`first` 0, 51, missing, non-integer); each connection gets a `first: 51` →
  `BAD_USER_INPUT` integration test (TESTING.md PAG-*).
- `scripts/check-schema-drift.ts`: build the API, run `cli/emit-schema`, then `git diff --exit-code
  packages/contracts/schema.graphql`; run web codegen and `typecheck` against it.

---

## 8. Commands (planned root `package.json` scripts)

| Command | Runs | Fails when |
|---|---|---|
| `pnpm format:check` | Prettier | Unformatted file |
| `pnpm lint` | `turbo run lint` (ESLint) | Any error |
| `pnpm typecheck` | `turbo run typecheck` (`tsc --noEmit`, after `codegen`) | Type error |
| `pnpm check:file-size` | `tsx scripts/check-file-size.ts` | File > 200 lines |
| `pnpm check:duplication` | `jscpd --config .jscpd.json` | Any clone |
| `pnpm check:deps` | `scripts/check-deps.ts` → dependency-cruiser on the workspace roots that exist | Rule violation or cycle |
| `pnpm check:no-polling` | `tsx scripts/check-no-polling.ts` | Pattern found outside the allow-list |
| `pnpm check:pagination` | pagination + prisma-take scripts | Unbounded list |
| `pnpm check:schema` | schema drift script | SDL or generated types out of date |
| `pnpm check:secrets` | `gitleaks detect` | Secret found |
| `pnpm audit:deps` | `pnpm audit --audit-level high` | High or critical advisory without a recorded, dated exception |
| `pnpm test` | `turbo run test` (unit) | Failure or coverage below §10 |
| `pnpm test:integration` | API and database integration against real PostgreSQL + Redis (TESTING.md §2) | Failure |
| `pnpm test:e2e` | Playwright | Failure |
| `pnpm build` | `turbo run build` | Build error |
| `pnpm verify` | All of the above except e2e and secrets, in this order: format, lint, typecheck, file-size, duplication, deps, no-polling, pagination, test, build, schema | Any step fails |

---

## 9. CI gating and review

- `ci.yml` jobs: `quality` (format, lint, typecheck, file-size, duplication, deps, no-polling, pagination,
  schema, secrets), `unit`, `integration`, `build`, `e2e` (PRs to `main`), `audit`. Branch protection on `main`
  requires **all** jobs green, at least one approving review and an up-to-date branch. No admin bypass.
- A phase or feature is **not accepted** until `pnpm verify` and `pnpm test:e2e` pass locally or in CI, and the
  PR checklist is complete.
- **PR checklist (`.github/pull_request_template.md`):** feature ids from FEATURES.md · docs updated together ·
  no new polling or timers · every new list paginated (≤ 50) · `select` on every Prisma call · events small and
  scoped · Redis use justified and degraded mode defined · money via `@pos/domain` · permissions declared · PII
  not logged · tests added (unit, integration and, where relevant, concurrency/realtime/e2e).

**Manual audits** (once per phase, recorded in IMPLEMENTATION_PLAN.md's progress ledger), for what static
checks cannot prove:
1. N+1: integration tests assert query counts for list endpoints (Prisma query event counter ≤ 3 per list request).
2. Payload size: response-size tests for the operations in NETWORK_OPTIMIZATION.md §4.2.
3. PII: grep logs from an e2e run for seeded customer names and phones; there must be zero hits.
4. Event payloads: review against API.md §7 (no PII, ≤ 1 KB).
5. Redis degraded mode: run the RED-* tests (TESTING.md).

---

## 10. Naming, formatting and coverage

| Item | Convention |
|---|---|
| API files | `kebab-case` with role suffix: `create-sale.service.ts`, `orders.repository.ts`, `order.type.ts`, `sale.inputs.ts` |
| Web components | `PascalCase.tsx`, one exported component per file |
| Hooks | `useThing.ts` (camelCase, `use` prefix) |
| Other web/package files | `kebab-case.ts` |
| Tests | API: `*.spec.ts` (unit), `*.int.spec.ts` (integration). Web and packages: `*.test.ts(x)`. E2E: `e2e/tests/*.spec.ts` |
| Identifiers | `camelCase` values, `PascalCase` types/classes/components, `SCREAMING_SNAKE` constants and env vars; booleans `is/has/can/should`; no abbreviations except `id`, `url`, `ws`, `db` |
| Enums | String unions from `@pos/contracts/enums.ts`; no TS `enum` keyword outside NestJS `registerEnumType` wrappers |
| GraphQL, DB, Redis, events | API.md §1, DATABASE.md §1, SYSTEM_DESIGN.md §6.2, API.md §7.2 |
| Formatting | Prettier: `printWidth 100`, `singleQuote`, `trailingComma: all`, `semi`; EditorConfig LF, 2 spaces |
| Coverage (Vitest, v8) | `packages/domain` ≥ 95 % lines and branches; `packages/validation` ≥ 90 %; API `application/` ≥ 85 %; web `features/*/state` and `hooks` ≥ 80 %. Coverage never replaces the FIN/RT/RED test cases in TESTING.md |
