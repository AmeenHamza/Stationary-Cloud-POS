# INSTRUCTIONS.md — Engineering Conventions

**Status:** Proposed, awaiting owner review (design stage).
**Last updated:** 2026-10-28

How to build things in this repository. Machine-enforced rules (file size, duplication, boundaries, lint,
naming, CI) live in [CODING_STANDARDS.md](CODING_STANDARDS.md) and are only referenced here. Architecture:
[ARCHITECTURE.md](ARCHITECTURE.md). Folder map: [REPOSITORY_STRUCTURE.md](REPOSITORY_STRUCTURE.md).

---

## 1. Workflow for any change

1. Identify the feature id (`F-xx`) and rules (`BR-xx`, `D-xx`) in FEATURES.md. If the behaviour is not there,
   stop: record a question in FEATURES.md §6 and do not invent it.
2. **Search before writing.** Check the single-home table (REPOSITORY_STRUCTURE.md §4), `@pos/domain`,
   `@pos/validation`, `components/` and `lib/` for an existing implementation.
3. Build a **vertical slice**: migration → repository → application service → resolver → validation schema →
   fragment and operation → UI → events → tests.
4. Update the affected documents **in the same change** (API.md for operations, DATABASE.md for schema,
   SYSTEM_DESIGN.md for flows or Redis keys, DECISIONS.md for choices).
5. Run `pnpm verify` (CODING_STANDARDS.md §8). Never weaken a check to pass it.

---

## 2. Where code goes

### 2.1 Backend recipe: adding a use case to module `<m>`

| Step | File | Content |
|---|---|---|
| 1 | `packages/validation/src/<m>.schemas.ts` | Zod schema `xxxInputSchema` and its type `XxxInput` |
| 2 | `modules/<m>/graphql/<entity>.inputs.ts` | `@InputType()` class with the same fields (shape only) |
| 3 | `modules/<m>/persistence/<entity>.repository.ts` | Typed queries with `select`, keyset helpers |
| 4 | `modules/<m>/application/<use-case>.service.ts` | One public method; `UnitOfWork.run()`; domain calls; outbox; audit |
| 5 | `modules/<m>/graphql/<entity>.resolver.ts` | Permission decorator, `ZodValidationPipe`, delegate to service |
| 6 | `modules/<m>/index.ts` | Export only if another module needs the service |
| 7 | Tests | `*.spec.ts` beside the service; `test/integration/<m>/*.int.spec.ts` |

Thin resolver, use-case service and projected repository (shape to follow):

```ts
// modules/catalog/inventory/graphql/inventory.resolver.ts
@Resolver()
export class InventoryResolver {
  constructor(private readonly restock: RestockService) {}

  @Mutation(() => RestockPayload)
  @RequirePermission('inventory:restock')
  restockProduct(
    @Args('input', new ZodValidationPipe(restockInputSchema)) input: RestockInput,
    @CurrentViewer() viewer: Viewer,
  ): Promise<RestockPayload> {
    return this.restock.execute(input, viewer);
  }
}
```

```ts
// modules/catalog/inventory/application/restock.service.ts
@Injectable()
export class RestockService {
  constructor(private readonly uow: UnitOfWork, private readonly ledger: StockLedgerService,
              private readonly audit: AuditService) {}

  execute(input: RestockInput, viewer: Viewer): Promise<RestockPayload> {
    return this.uow.run(async () => {
      const pieces = toPieces(input.boxes, input.pieces, await this.ledger.piecesPerBox(input.productId));
      const result = await this.ledger.apply({ productId: input.productId, type: 'RESTOCK',
        quantityPieces: pieces, idempotencyKey: input.idempotencyKey, actorUserId: viewer.id });
      await this.audit.record('stock.restocked', viewer, { productId: input.productId, pieces });
      return result; // StockLedgerService adds stock.changed (+ crossing event) to the outbox
    });
  }
}
```

```ts
// modules/catalog/inventory/persistence/stock.repository.ts
async applyDelta(productId: string, delta: number) {
  return this.tx.client.product.update({
    where: { id: productId },
    data: { stockPieces: { increment: delta }, version: { increment: 1 } },
    select: { id: true, stockPieces: true, lowStockThresholdPieces: true, version: true }, // always select
  });
}
```

### 2.2 Frontend recipe: adding a screen to feature `<f>`

| Step | File |
|---|---|
| 1 | Fragment in `src/graphql/fragments/<entity>.fragments.ts` (reuse if one fits the view) |
| 2 | Operation in `features/<f>/graphql/<f>.documents.ts` using `graphql()` from codegen |
| 3 | `pnpm codegen` to generate typed documents |
| 4 | Screen `features/<f>/components/<Thing>Screen.tsx` (`'use client'`) using `useCursorPagedQuery` and `QueryState` |
| 5 | Route `app/(app)/(admin)/<route>/page.tsx` (server component) rendering the screen |
| 6 | Event handling: add or extend a handler in `lib/realtime/handlers/` if the screen shows live data |
| 7 | Tests: `*.test.tsx` for hooks and state; e2e spec if it is a critical workflow |

---

## 3. TypeScript practices

- IDs are `string`; money is `Decimal` in code and the `Money` string at boundaries; never `number`.
- Prefer discriminated unions over boolean flags (`{ type: 'FLAT', amount } | { type: 'PERCENT', percent }`).
- Exported functions declare explicit return types. No default exports except Next.js route files and
  config files.
- Business code never reads `process.env`; use `AppConfig` (API) or `lib/env.ts` (web).
- Expected failures throw `AppError`; never return `null` to mean "error".

---

## 4. Error handling

| Do | Don't |
|---|---|
| `throw new AppError('PRICE_CHANGED', 'Prices changed', { quote })` with a code from `@pos/contracts` | Throw raw `Error` for expected business outcomes |
| Let errors propagate to the formatter/filter, which logs once with `requestId` | Log and re-throw at every layer |
| Map Prisma errors in `prisma-error.mapper.ts` only | Inspect Prisma error codes in services |
| Show users messages from `lib/errors/user-messages.ts` | Show `error.message` from the server verbatim |
| Use `QueryState` for loading/empty/error, with a user-triggered retry | Auto-retry queries on timers |

User-facing messages are plain English. Internal details (SQL, stack traces, ids of other users) never reach
the client.

---

## 5. Validation

- One Zod schema per input in `@pos/validation`, named `<operation>InputSchema`. Shared atoms (money string,
  percent, uuid, phone, trimmed name) live in `common.ts`.
- Forms use `zodResolver(schema)` with the **same** schema the API uses. API resolvers apply
  `ZodValidationPipe(schema)`. Cross-field rules (e.g. `UDHAAR` requires `customerId`) belong in the schema
  (`superRefine`).
- Rules that need the database (barcode uniqueness, stock, existence) are checked in services and return
  `CONFLICT` / `NOT_FOUND`, never in Zod.

---

## 6. Security rules

1. Every resolver or controller method has `@RequirePermission` or `@Public`; new permissions are added to
   `@pos/contracts/permissions.ts` and API.md §5.
2. Never trust client totals, prices, stock or user ids. Recompute or derive them from the session.
3. Never log passwords, tokens, cookies, the Groq key, customer names, phones or addresses (pino redaction is
   a safety net, not permission).
4. Secrets come only from env vars (DEPLOYMENT.md §4). Never commit `.env` files or paste secrets into docs,
   tests or fixtures.
5. Raw SQL only through TypedSQL files or tagged `$queryRaw` templates.
6. New REST endpoints require the CSRF header and CORS allowlist; uploads are checked for size, extension and
   magic bytes.
7. Sensitive actions write an audit entry (SYSTEM_DESIGN.md §9.3).

---

## 7. GraphQL conventions

- Naming, nullability, scalars, errors: API.md §1–§4.
- **Lists** return a connection built with `Connection(Type)` from `common/pagination/connection.factory.ts`,
  using `PageArgs` and `keyset.ts`. Never hand-roll pagination.
- **Relations** in field resolvers use the per-request DataLoaders created in `graphql-context.ts` (e.g.
  `ctx.loaders.categoryById`). Never `findUnique` inside a list field resolver.
- **Field permissions** use `@RequirePermission` on `@ResolveField` (e.g. `costPrice`).
- **Mutations** that change money or stock take `idempotencyKey`; edits take `version`.
- **Payloads** return the changed entity with its `version`, so Apollo updates the cache without a refetch.
- **Client:** fragments live once in `src/graphql/fragments`; operations compose them. Type
  `fetchPolicy` per NETWORK_OPTIMIZATION.md §6. Never use `pollInterval`.
- After changing resolvers: `pnpm schema:emit` and `pnpm codegen`, and commit `schema.graphql`.

---

## 8. Real-time (WebSocket) conventions

Adding an event:
1. Name it in `@pos/contracts/events.ts` (`<entity>.<pastTenseVerb>`) with audience and schema version.
2. Add an `@ObjectType()` implementing `ShopEvent` in `modules/realtime/graphql/shop-event.types.ts`, and
   register it in the interface resolver.
3. Build the payload in the owning module's `*-events.ts`: ids, `version`, changed scalars, ≤ 1 KB, no PII,
   no cost prices.
4. Add it in the use case with `outbox.add(event)` **inside** `UnitOfWork.run()`. Never publish directly to
   Redis from a service.
5. Handle it on the client in `lib/realtime/handlers/<area>.ts`: patch by `version`, or a coalesced refetch of an
   active query. Never fetch data that is not on screen.
6. Tests: an integration test that the event is emitted with the right audience; a client handler unit test;
   update the API.md §7.2 table.

Never open additional subscriptions per screen. `shopEvents` is the only subscription.

---

## 9. Redis conventions

- Build keys only through `infrastructure/cache/cache-keys.ts`; register every new key family in
  SYSTEM_DESIGN.md §6.2 with its TTL and invalidation.
- Every key has a TTL (except generation counters). Cache fills use `NX`. Invalidate **after commit** by
  bumping the generation.
- Wrap every Redis call so a Redis failure becomes a cache miss or the documented degraded mode. A Redis error
  must never fail a sale, refund, khata entry or stock change.
- Do not cache stock, prices used for billing, orders, ledgers, balances or customer records.
- No distributed locks without a DECISIONS.md entry (SYSTEM_DESIGN.md §6.7).
- New BullMQ queues need a DECISIONS.md entry, idempotent processors, and defined retry and retention.

---

## 10. Database and migration rules

- All writes go through application services inside `UnitOfWork.run()`. Repositories obtain the client from
  `TransactionHost`.
- Lock order for multi-row writes: order row → products by ascending id → bill counter → customer/vendor row.
- Every `findMany` has `take` (≤ 51 for pages) or a `// bounded:` comment; every `update`/`create` has
  `select`.
- Aggregates are SQL (TypedSQL in `packages/database/prisma/sql`), never computed by fetching rows.
- Migration workflow:
  1. Edit `packages/database/prisma/schema/<area>.prisma`.
  2. `pnpm --filter @pos/database migrate:dev --create-only --name <snake_name>`.
  3. Add checks and partial/trigram indexes to the SQL; keep the file ≤ 200 lines.
  4. Apply with `migrate:dev`; update DATABASE.md; add integration tests for new constraints.
- Never run `prisma db push`, `migrate reset` or destructive SQL against anything but local Docker. The
  `db:*` scripts refuse non-local URLs.

---

## 11. Frontend conventions

- **Server vs client:** route files and layouts are server components. Add `'use client'` only to screens,
  interactive components and providers. Data fetching happens in client components through Apollo
  (ADR-003).
- **Business logic:** components never compute money except through `@pos/domain` (cart preview, refund
  preview). Formatting uses `@pos/domain/format`.
- **State:** server data in Apollo; cart in `CartProvider`; no new global stores (ADR-019).
- **Forms:** React Hook Form + Zod resolver; `MoneyInput`/`PercentInput`/`QuantityInput` from `components/forms`;
  submit buttons disabled while pending; mutations carry `idempotencyKey` from `lib/ids`.
- **Accessibility:** every input has a label; dialogs trap focus and restore it; full keyboard operation of
  the terminal (scanner input keeps focus; `Enter` adds; a payment shortcut key, proposed `F9`, plus the
  button opens payment); an `aria-live`
  region announces scan results and stock warnings; colour is never the only signal (status badges have text);
  WCAG AA contrast in both themes.
- **Text direction:** Urdu text renders with `dir="auto"` (`dir="rtl"` for Urdu AI output). The UI language is
  English (Q24).
- **Performance:** `next/dynamic` for charts and the AI Markdown renderer; table rows memoized; no data
  fetching inside `useEffect` loops.

---

## 12. Logging and observability

- API: `nestjs-pino`, JSON logs with `requestId`, `userId`, `operationName`, `durationMs`, `outcome`. Levels:
  `error` (needs attention), `warn` (degraded, e.g. Redis down), `info` (one line per request or job), `debug`
  (off in production).
- Metrics (`prom-client`): names `pos_<area>_<metric>_<unit>`, e.g. `pos_cache_requests_total{family,result}`,
  `pos_outbox_unpublished`, `pos_ws_connections`. Labels never contain ids or PII.
- Web: Sentry for unexpected errors only; `user-messages.ts` handles expected codes without reporting.

---

## 13. CLI and admin scripts

Scripts in `apps/api/src/cli`, `tools/*` and `scripts/` must:
- print bounded output by default (counts plus the first 50 items) and accept `--limit`;
- write full listings to a file, not the terminal;
- default to read-only or `--dry-run`; destructive actions need an explicit flag and refuse production URLs
  unless `--i-know-this-is-production` is given and the target is printed first;
- never print secrets or connection strings (mask host and password).

---

## 14. Testing requirements per change

| Change | Required tests (TESTING.md) |
|---|---|
| Domain rule | Unit tests with table-driven cases, including FIN examples |
| New mutation | Validation, permission (SEC matrix), integration with DB, idempotency replay if `[K]` |
| Money or stock path | FIN cases, concurrency test, Redis-down test |
| New list | Pagination tests (PAG-01–PAG-06), response-size test |
| New event | Emission test with audience, client handler test |
| New Redis use | Cache invalidation/staleness test, Redis-down test |
| New screen | Hook/state unit tests; e2e if it is part of a critical workflow |
