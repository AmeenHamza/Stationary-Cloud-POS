# API.md — GraphQL, WebSocket and REST Contract

**Status:** Proposed, awaiting owner review (design stage). The schema below is the target. The emitted SDL
(`packages/contracts/schema.graphql`) becomes authoritative once implemented.
**Last updated:** 2026-10-28
**Related:** [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md) (behaviour) · [DATABASE.md](DATABASE.md) (storage) ·
[DECISIONS.md](DECISIONS.md) ADR-004/008/011/015/017

---

## 1. Conventions

| Topic | Rule |
|---|---|
| Endpoints | `POST https://api.<domain>/graphql` (queries, mutations) · `wss://api.<domain>/graphql` (subscriptions, `graphql-transport-ws`) · REST under `/v1` (§9) |
| Approach | Code-first NestJS (ADR-004). SDL emitted to `packages/contracts/schema.graphql`, committed, drift-checked in CI |
| Naming | Types `PascalCase`; fields and arguments `camelCase`; enum values `SCREAMING_SNAKE`; mutations `verbNoun` (`createSale`); inputs `<Mutation>Input`; payloads `<Mutation>Payload`; lists `<Entity>Connection` |
| Nullability | Non-null by default; nullable only when absence is meaningful (e.g. `barcode`) |
| Evolution | Additive changes only. Removal: `@deprecated(reason)` for at least one production release, then removal in a later release (web deploys after API; DEPLOYMENT.md §6) |
| Limits | Depth ≤ 10, complexity ≤ 1,000 (a connection costs `1 + first × item cost`; object fields cost 1, scalar and enum fields 0, so a page of 50 full rows costs ≈ 100), request body ≤ 1 MB, no query batching, introspection disabled in production |
| CSRF | Apollo CSRF prevention on: requests must send `Content-Type: application/json` (forces a CORS preflight) |
| Credentials | Session cookie `__Host-pos_sid` sent with `credentials: 'include'` (ADR-011) |
| Caching | `Cache-Control: no-store` on all GraphQL responses; client caching is Apollo's normalized cache |
| Persisted queries | Not in v1 (considered; see NETWORK_OPTIMIZATION.md §5) |

---

## 2. Scalars and shared enums

| Scalar | Wire format | Example | Validation |
|---|---|---|---|
| `Money` | Decimal string, exactly 2 fraction digits on output; input accepts `^\d{1,10}(\.\d{1,2})?$` | `"283.20"` | Parsed to `Decimal`; never a JS number |
| `Percent` | Decimal string 0–100, 2 decimals | `"18.00"` | |
| `BusinessDate` | `YYYY-MM-DD` (Asia/Karachi) | `"2026-10-28"` | |
| `DateTime` | ISO-8601 UTC | `"2026-10-28T17:09:06.000Z"` | |
| `ID` | String (UUID, or decimal string for bigint ids) | | |

Shared enums (values equal `@pos/contracts/enums.ts` and the DB enums): `UserRole`, `UserStatus`, `SaleUnit`,
`PaymentMethod`, `DiscountType`, `OrderStatus`, `StockMovementType`, `AdjustmentReason`,
`CustomerEntryType`, `VendorEntryType`, `ImportStatus`, `ImportRowStatus`, `AiLanguage` (`ENGLISH`, `URDU`,
`ROMAN_URDU`), `AiReportPeriod` (`DAILY`, `WEEKLY`, `MONTHLY`, `CUSTOM`), `AiChatRole` (`USER`, `ASSISTANT`), `ProductSort`,
`RankingDirection`.

---

## 3. Pagination contract (mandatory, max 50)

```graphql
type PageInfo {
  hasNextPage: Boolean!
  endCursor: String          # null when nodes is empty
}

# Every list field returns a connection with this exact shape:
type ProductConnection {
  nodes: [Product!]!
  pageInfo: PageInfo!
  totalCount: Int            # computed only when selected (extra COUNT query)
}
```

| Rule | Detail |
|---|---|
| Arguments | `first: Int = 50`, `after: String` on every connection field |
| Limits | `1 ≤ first ≤ 50`, enforced by `PageArgs` (Zod) in the API. `first: 51` → `BAD_USER_INPUT` |
| Sorting | Each field has a fixed sort enum (default first) plus `id` as the tiebreaker, so order is total and stable |
| Cursor | Opaque base64url of `{"v":1,"s":"<sort>","k":[<sortValue>,"<id>"]}`. A cursor from another sort or version, or a malformed one → `BAD_CURSOR` |
| Query | Keyset `WHERE (sortCol, id) > (k0, k1)` with `LIMIT first + 1`; never `OFFSET` |
| Empty page | `nodes: []`, `hasNextPage: false`, `endCursor: null` |
| Previous page | Client keeps a stack of cursors (`useCursorPagedQuery`). There is no backward pagination in the API |
| Archive default | Order and ledger lists default to the last 90 days; `includeArchived: true` removes the bound (D-12) |
| Totals | Business totals (balances, dashboard sums) are SQL aggregates over the complete data, **never** sums of a page |

**Bounded exceptions** (plain lists, documented and enforced by `check:graphql-pagination`'s allow-list):

| Field | Bound | Why |
|---|---|---|
| `Order.lines`, `Receipt.lines` | ≤ 100 (`MAX_LINES_PER_SALE`, Q34) | Part of one bill; validated at creation |
| `productsByIds(ids)` | ≤ 50 ids | Targeted reconciliation of cart/visible items |
| `Dashboard.monthlySales` | 12 | Calendar months |
| `Dashboard.dailySales` | ≤ 31 | `days` argument max 31 |
| `Dashboard.paymentMethods` | ≤ 6 | Enum-sized |
| `Dashboard.productRanking` | ≤ 10 | `limit` max 10 |
| `Viewer.permissions` | ≤ 30 | Enum-sized |
| `StockChangedEvent.items` | ≤ 100 | One transaction's lines |

Example:

```graphql
query TerminalProducts($filter: ProductFilter, $after: String) {
  products(filter: $filter, sort: NAME_ASC, first: 50, after: $after) {
    nodes { ...ProductTileFields }
    pageInfo { hasNextPage endCursor }
  }
}
fragment ProductTileFields on Product {
  id name nameUrdu salePrice boxPrice piecesPerBox stockPieces isLowStock version
}
```

```json
{ "data": { "products": {
  "nodes": [ { "id": "0192f0c1-…", "name": "a3 plastic coting", "nameUrdu": null, "salePrice": "120.00",
               "boxPrice": null, "piecesPerBox": 1, "stockPieces": 50, "isLowStock": false, "version": 7 } ],
  "pageInfo": { "hasNextPage": true, "endCursor": "eyJ2IjoxLCJzIjoiTkFNRV9BU0MiLCJrIjpbImEzIHBsYXN0aWMgY290aW5nIiwiMDE5MmYwYzEtLi4uIl19" }
} } }
```

---

## 4. Errors

Errors follow the GraphQL spec. `extensions.code` is one of the codes below (source:
`@pos/contracts/errors.ts`). Production responses never contain stack traces, SQL or internal messages;
`INTERNAL_SERVER_ERROR` carries only `requestId`.

| Code | When | Client behaviour (`lib/errors/user-messages.ts`) |
|---|---|---|
| `UNAUTHENTICATED` | Missing, expired or revoked session | Clear cache, go to `/login` |
| `FORBIDDEN` | Permission missing | Toast; hide action |
| `BAD_USER_INPUT` | Zod or argument validation failed; `extensions.fieldErrors: { path: message }` | Map to form fields |
| `NOT_FOUND` | Entity missing or archived where active is required | Toast + navigate back |
| `CONFLICT` | Stale `version`, or unique violation (barcode, username, category name) | Reload entity, show diff/message |
| `IDEMPOTENCY_KEY_REUSED` | Same key, different payload | Generate a new key; resubmit only after user confirmation |
| `PRICE_CHANGED` | `expectedTotal` ≠ server total; `extensions.quote` holds the server totals and `changedProductIds` | Refresh cart prices (`productsByIds`), show the new total, ask the cashier to confirm |
| `QUOTE_MISMATCH` | Refund `expectedAmount` ≠ server amount; `extensions.amount` | Show the new amount, confirm |
| `REFUND_EXCEEDS_REMAINING` | Requested quantity > refundable | Reload order lines |
| `CUSTOMER_REQUIRED` | `UDHAAR` without `customerId` | Open the customer picker |
| `BALANCE_NOT_ZERO` | Archiving a customer/vendor with a balance (Q33) | Explain |
| `HAS_HISTORY` | Deleting a product, customer, vendor or staff account that bills, khata entries or recorded work depend on (D-28) | Explain; offer Archive or Disable |
| `LAST_ADMIN` | Disabling or demoting the last active admin | Explain |
| `RATE_LIMITED` | Bucket exceeded; `extensions.retryAfterSeconds` | Toast with wait time |
| `BAD_CURSOR` | Invalid or stale cursor | Restart the list from the first page |
| `AI_NOT_CONFIGURED` / `AI_UNAVAILABLE` | No Groq key / provider error or timeout | Message on AI screen |
| `INTERNAL_SERVER_ERROR` | Anything else | Toast "Something went wrong (ref …)" |

```json
{ "errors": [ { "message": "Prices changed since the cart was built.",
  "path": ["createSale"],
  "extensions": { "code": "PRICE_CHANGED", "requestId": "req_01J…",
    "quote": { "subtotal": "250.00", "discountTotal": "0.00", "productTaxTotal": "0.00", "billGstAmount": "0.00", "total": "250.00" },
    "changedProductIds": ["0192f0c1-…"] } } ], "data": null }
```

---

## 5. Authorization

Every resolver and controller method has exactly one access policy: `@RequirePermission(...)`,
`@Authenticated()` (any signed-in user: `me`, `logout`, `changePassword`) or `@Public()` (`login`,
`serverInfo`, health, metrics with its bearer token). The global `AccessGuard` refuses a handler without one
(fail closed), and SEC-01 (`access-policy.int.spec.ts`) fails the build if one is missing. Permissions come
from `@pos/contracts/permissions.ts`.

| Permission | Admin | Cashier | Grants |
|---|---|---|---|
| `catalog:read` | ✓ | ✓ | Products, categories, low stock (no cost price) |
| `catalog:write` | ✓ | | Product/category CRUD, clone, archive, delete; `Product.costPrice` |
| `inventory:restock` | ✓ | | `restockProduct` |
| `inventory:adjust` | ✓ | | `adjustStock`, `stockMovements` (D-18) |
| `sales:create` | ✓ | ✓ | `createSale` |
| `sales:discount` | ✓ | ✓ | Non-`NONE` discount, overall or on an item, in `createSale` (D-11, D-27) |
| `orders:read` | ✓ | ✓ | Order history, receipts |
| `orders:refund` | ✓ | ✓ | `refundOrder` (D-11) |
| `customers:read` / `customers:write` | ✓ | ✓ | Customers, khata entries (D-11) |
| `customers:archive` | ✓ | | Archive, restore and delete customers |
| `vendors:read` / `vendors:write` | ✓ | ✓ | Vendors, purchases, payments (D-11) |
| `vendors:archive` | ✓ | | Archive, restore and delete vendors |
| `dashboard:read` | ✓ | | `dashboard` |
| `staff:manage` | ✓ | | Staff queries and mutations |
| `settings:read` | ✓ | ✓ | `shopSettings` (profile, default GST) |
| `settings:write` | ✓ | | Settings mutations; `aiKeyConfigured`, `aiKeyLast4` |
| `ai:use` | ✓ | | AI mutations (D-22) |
| `catalog:import` / `catalog:export` | ✓ | | REST import/export, `importJob` |
| `audit:read` | ✓ | | `auditLogs` (P-01) |

Object-level checks: there is one shop and no per-record ownership, so every authorized user may access any
record of a permitted type. IDs are validated as UUIDs, so malformed ids never reach SQL.

---

## 6. Operation catalog

`[K]` = requires `idempotencyKey: ID!` (UUIDv7, generated by the client once per user action; ADR-015).
`[V]` = requires the entity's current `version` (optimistic lock).

### 6.1 Queries

| Query | Permission | Returns / notes |
|---|---|---|
| `serverInfo` | public | `{ version, businessDate }`: the terminal header date comes from the server's business date |
| `me` | authenticated | `Viewer { id username fullName role permissions }` |
| `staffUsers(filter: { search, status }, first, after)` | staff:manage | `StaffUserConnection`, sort `NAME_ASC` |
| `shopSettings` | settings:read | `ShopSettings` (profile, `version`, `updatedAt`). `aiKeyConfigured` and `aiKeyLast4` are field-level `settings:write` (SEC-03) |
| `categories(filter: { search }, first, after)` | catalog:read | `CategoryConnection` (`productCount` per node, one grouped query) |
| `category(id)` | catalog:read | `Category` |
| `products(filter: ProductFilter, sort: ProductSort = NAME_ASC, first, after)` | catalog:read | `ProductConnection`. Filter: `search`, `categoryId`, `uncategorised`, `lowStockOnly`, `includeArchived` |
| `product(id)` | catalog:read | `Product` |
| `productByBarcode(barcode)` | catalog:read | `Product` or null (exact, active only) |
| `productsByIds(ids)` | catalog:read | `[Product!]!`, ≤ 50 ids |
| `lowStockProducts(first, after)` | catalog:read | `ProductConnection`, sort `STOCK_ASC` |
| `lowStockCount` | catalog:read | `Int!` |
| `stockMovements(productId, first, after)` | inventory:adjust | `StockMovementConnection` (P-02 UI) |
| `orders(filter: { billNumberPrefix, status, from, to, customerId, includeArchived }, first, after)` | orders:read | `OrderConnection`, newest first |
| `order(id)` | orders:read | `OrderDetail`: the bill with its `lines` (≤ 100) and what each line and the Bill GST have had refunded (`refundedQuantity`, `refundedAmount`, `refundedGstShare`), so the refund dialog prices with `@pos/domain` |
| `orderReceipt(orderId)` | orders:read | `Receipt` (reprint) |
| `saleStatus(idempotencyKey)` | sales:create | `Order` or null. Confirms the outcome of an unconfirmed sale (SYSTEM_DESIGN.md §3.4) |
| `customers(filter: { search, withBalanceOnly, includeArchived }, first, after)` | customers:read | `CustomerConnection`; search matches name or phone digits |
| `customer(id)` | customers:read | `Customer` |
| `customerLedger(customerId, includeArchived, first, after)` | customers:read | `CustomerLedgerEntryConnection`, newest first; `orderId` and `billNumber` name the bill of a credit sale, which `orderReceipt` regenerates (F-40) |
| `vendors(…)`, `vendor(id)`, `vendorLedger(…)` | vendors:read | Same shapes as customers |
| `dashboard(date: BusinessDate)` | dashboard:read | `Dashboard` (§6.3) |
| `importJob(id)` | catalog:import | `ImportJob` |
| `importJobRows(jobId, status, first, after)` | catalog:import | `ImportJobRowConnection` |
| `auditLogs(filter: { action, entityType, entityId, actorId, from, to }, first, after)` | audit:read | `AuditLogConnection` (P-01) |

### 6.2 Mutations

| Mutation | Permission | Notes |
|---|---|---|
| `login(input: { username, password })` | public, rate-limited | Sets cookie; returns `Viewer` |
| `signUp(input: { fullName, username, password, role, signupSecret })` | public, rate-limited; shared key required | Creates the selected role and returns `Boolean!`; does not sign in |
| `logout` | authenticated | Revokes the current session; clears cookie; returns `Boolean!` |
| `changePassword(input: { currentPassword, newPassword })` | authenticated | Revokes the user's other sessions; returns `Boolean!`; a wrong current password is `BAD_USER_INPUT` with `fieldErrors.currentPassword` |
| `createStaffUser(input: { username, fullName, role, password })` | staff:manage | Returns `StaffUser`; a taken username is `CONFLICT` with `fieldErrors.username`. All staff mutations return `StaffUser { id username fullName role status version createdAt }` |
| `updateStaffUser(input: { id, fullName, role, version })` [V] | staff:manage | Role change revokes that user's sessions |
| `setStaffUserStatus(input: { id, status })` | staff:manage | `DISABLED` revokes sessions; `LAST_ADMIN` guard |
| `resetStaffPassword(input: { id, newPassword })` | staff:manage | Revokes sessions |
| `deleteStaffUser(id)` | staff:manage | Returns `true`. Removes the account (D-28): `HAS_HISTORY` if it has bills, refunds, stock or khata entries, imports, settings or other accounts, or any audited action except signing in or out; `CONFLICT` for your own account; `LAST_ADMIN` guard |
| `updateShopSettings(input: { shopName, address, phone, receiptFooter, defaultBillGstRate, version })` [V] | settings:write | |
| `setAiApiKey(input: { apiKey })` / `clearAiApiKey` | settings:write | Return `ShopSettings`. The key (20–200 characters, no spaces) is encrypted and never returned; only `aiKeyLast4`. Emits `settings.changed` |
| `createCategory` / `updateCategory` [V] / `deleteCategory(id)` | catalog:write | Delete moves products to Uncategorised |
| `createProduct(input: { idempotencyKey, …fields, initialStockPieces })` [K] | catalog:write | `OPENING` movement if stock > 0 |
| `updateProduct(input: { id, version, …fields })` [V] | catalog:write | Cannot change stock (BR-03) |
| `cloneProduct(input: { idempotencyKey, sourceProductId, barcode, initialStockPieces })` [K] | catalog:write | One call per scanned unit (D-19) |
| `archiveProduct(id)` / `restoreProduct(id)` | catalog:write | |
| `deleteProduct(id)` | catalog:write | Returns `true`. Removes a product no bill sold, with its stock history (D-28); `HAS_HISTORY` otherwise |
| `restockProduct(input: { idempotencyKey, productId, boxes, pieces, note })` [K] | inventory:restock | Adds `boxes × piecesPerBox + pieces` |
| `adjustStock(input: { idempotencyKey, productId, direction, quantityPieces, reason, note })` [K] | inventory:adjust | D-18 |
| `createSale(input: CreateSaleInput)` [K] | sales:create (+ sales:discount) | §10.2 |
| `refundOrder(input: { idempotencyKey, orderId, lines: [{ orderLineId, quantity }], refundAll, reason, expectedAmount })` [K] | orders:refund | Exactly one of `lines` / `refundAll`. Returns `RefundOrderPayload { order: OrderDetail, refund: RefundSummary, replayed }`; `QUOTE_MISMATCH` carries the server's `amount` |
| `createCustomer` / `updateCustomer` [V] | customers:write | |
| `archiveCustomer(id)` / `restoreCustomer(id)` | customers:archive | `BALANCE_NOT_ZERO` guard |
| `deleteCustomer(id)` | customers:archive | Returns `true`. Only with no bills or khata entries (`HAS_HISTORY`, D-28) |
| `addCustomerCredit(input: { idempotencyKey, customerId, amount, note })` [K] | customers:write | "Add Udhaar" (`MANUAL_CREDIT`). Khata entry mutations return the party with its new balance |
| `receiveCustomerPayment(input: { idempotencyKey, customerId, amount, method, note })` [K] | customers:write | `method ≠ UDHAAR` |
| `createVendor` / `updateVendor` [V] | vendors:write | |
| `archiveVendor(id)` / `restoreVendor(id)` | vendors:archive | |
| `deleteVendor(id)` | vendors:archive | Returns `true`. Only with no khata entries (`HAS_HISTORY`, D-28) |
| `addVendorPurchase(input: { idempotencyKey, vendorId, amount, description })` [K] | vendors:write | Amount only (D-20) |
| `payVendor(input: { idempotencyKey, vendorId, amount, method, note })` [K] | vendors:write | |
| `aiSalesInsights(input: { periodDays, language })` | ai:use | `periodDays ∈ {7,14,30,60,90}` |
| `aiInventoryForecast(input: { language })` | ai:use | 30-day velocity |
| `aiPurchaseRecommendations(input: { language })` | ai:use | 45-day velocity |
| `aiAsk(input: { question, history, language })` | ai:use | `history` ≤ 10 turns, ≤ 4,000 chars total; not stored |
| `aiBusinessReport(input: { period, from, to, language })` | ai:use | `DAILY`, `WEEKLY`, `MONTHLY`, `CUSTOM` (≤ 92 days) |
| `aiDiscountAdvice(input: { language })` | ai:use | Advice only (BR-15) |

AI mutations return `AiResult { text: String! language: AiLanguage! generatedAt: DateTime! cached: Boolean! }`.
`text` is Markdown (headings, lists, tables). `cached` means the answer came from the 15-minute cache. `aiAsk` history turns are
`{ role: AiChatRole, text }`; `aiBusinessReport` needs `from`/`to` only for `CUSTOM` (not after today). Errors:
`AI_NOT_CONFIGURED` (no key, or Groq refused it), `AI_UNAVAILABLE` (provider down or timeout),
`RATE_LIMITED` (30 per hour, cached answers included; counted in memory while Redis is down, ADR-049).
They are mutations on purpose: reconnect reconciliation refetches active **queries** and must never repeat a
paid AI call (ADR-026).

### 6.3 Dashboard type

```graphql
type Dashboard {                     # every field is a separate SQL aggregate, run only if selected
  today: DaySummary!                 # netSales, billCount, discountTotal, taxTotal, refundTotal
  inventory: InventoryValue!         # sellingValue, costValue (stock > 0 only), productCount
  customerDues: Money!               # Σ positive customer balances (advances are not netted)
  monthlySales(year: Int!): [MonthlySales!]!                # 12 rows; + sameMonthLastYear for comparison
  dailySales(days: Int = 7, productId: ID): [DailySales!]!  # ≤ 31 rows
  discountSummary: PeriodTotals!     # today / thisWeek (Mon start) / thisMonth (Q18)
  taxSummary: TaxSummary!            # today / thisMonth / averagePerBill (product tax + bill GST, Q30)
  paymentMethods(period: ReportPeriod = THIS_MONTH): [PaymentMethodTotal!]!   # Q31
  productRanking(direction: RankingDirection!, limit: Int = 5, days: Int = 30): [ProductSales!]!
}
```

Net sales = Σ bill totals by bill date − Σ refunds by refund date (Q28 default). The low-stock tile uses the
`lowStockCount` query (the sidebar badge's), so the rule has one home. Inventory values count positive stock
of active products; a missing cost price counts as 0. Rankings are by pieces, only products sold in the period
(Q36). The screen sends two queries: `DashboardLive` (tiles, summaries, payment methods) and `DashboardHistory`
(months, 7 days, rankings); see ADR-039.

---

## 7. Subscriptions and events

### 7.1 Subscription

```graphql
type Subscription { shopEvents: ShopEvent! }   # one per browser tab; requires an authenticated socket

interface ShopEvent {
  seq: ID!              # outbox seq (bigint as string); de-duplication key
  type: String!         # e.g. "stock.changed"
  schemaVersion: Int!   # payload version; starts at 1
  occurredAt: DateTime!
}
```

The server subscribes the socket to Redis channels by role: cashiers get `pos:v1:ev:staff` and
`pos:v1:ev:user:{id}`; admins also get `pos:v1:ev:admin`. Audience filtering therefore happens **before**
delivery. A `withFilter` predicate re-checks the audience as a second line of defence.

### 7.2 Event catalog

Naming: `<entity>.<pastTenseVerb>` (camelCase entity). The GraphQL type is `<Entity><Verb>Event`. Payloads
carry ids, `version` and changed scalar fields only, with **no customer names, phones, cost prices or
secrets**. Money fields use the `Money` wire format (always two decimals, `"75.00"`, ADR-037), so a patched
value reads exactly like a queried one. Budget: ≤ 1 KB per event (NETWORK_OPTIMIZATION.md §4).

| Type | GraphQL type | Audience | Payload fields | Emitted by | Client action (`lib/realtime/handlers/*`) |
|---|---|---|---|---|---|
| `stock.changed` | `StockChangedEvent` | staff | `items[{ productId, stockPieces, isLowStock, version }]`; a transaction touching more products than fit in 1 KB (about 10) sends several of these events (ADR-049) | sale, refund, restock, adjust, create/clone with stock | Patch cached `Product` if `version` is newer; cart re-evaluates warnings |
| `product.changed` | `ProductChangedEvent` | staff | `change` (`CREATED`/`UPDATED`/`ARCHIVED`/`RESTORED`/`DELETED`), `productId`, `version`, `product: ProductSnapshot` (all public fields, no `costPrice`; **null** when deleted, or when the snapshot would push the event over 1 KB) | product commands | `writeFragment` if newer (a category move drops the cached `categoryName`); null snapshot → evict, mounted screens re-read. `ARCHIVED` patches `archivedAt`; lists drop it on the next fetch. `DELETED`: cached lists drop it and open carts remove it. `CREATED`: no list insertion |
| `catalog.bulkChanged` | `CatalogBulkChangedEvent` | staff | `reason: IMPORT`, `importJobId`, `changedCount` | import completion | Evict `products`/`categories` root fields; refetch active queries |
| `category.changed` | `CategoryChangedEvent` | staff | `change` (`CREATED`/`UPDATED`/`DELETED`), `categoryId`, `category: CategorySnapshot` (null when deleted) | category commands | Patch or evict; refetch active `categories` (counts) and, after a rename or delete, the active `products` page |
| `lowStock.countChanged` | `LowStockCountChangedEvent` | admin | `crossedProductIds[]` (a signal, so concurrent transactions cannot publish counts out of order; split like `stock.changed` above 1 KB) | in the transaction, when any product crossed its threshold | Coalesced refetch of `lowStockCount` (sidebar badge) and the active low-stock page |
| `order.created` | `OrderCreatedEvent` | admin | `orderId`, `billNumber`, `total`, `paymentMethod`, `businessDate`, `createdAt` | `createSale` | Orders screen: "N new orders" banner (`lib/realtime/new-orders.ts`), no refetch. Dashboard (Phase 10): coalesced refetch of `dashboard.today` |
| `order.refunded` | `OrderRefundedEvent` | staff | `orderId`, `status`, `refundedTotal`, `version` | `refundOrder` | Patch the cached `Order` if newer (order lists update in place); dashboard coalesced refetch (Phase 10) |
| `customer.balanceChanged` | `CustomerBalanceChangedEvent` | staff | `customerId`, `balance`, `version` | credit sale, payment, manual credit, refund credit | Patch `Customer.balance` (lists, khata headers). An open ledger is refetched (coalesced, mounted query only) |
| `vendor.balanceChanged` | `VendorBalanceChangedEvent` | staff | `vendorId`, `balance`, `version` | purchase, payment | Same as customers |
| `settings.changed` | `SettingsChangedEvent` | staff | `version` | `updateShopSettings` | Refetch `shopSettings` (≈ 300 bytes) |
| `import.progressed` | `ImportProgressedEvent` | `user:{initiator}` | `importJobId`, `status`, `processedRows`, `totalRows`, `succeededRows`, `failedRows` | import worker, per batch and at the end | Patch `ImportJob` |
| `system.resyncRequired` | `ResyncRequiredEvent` | that connection only | `reason` (`REDIS_RECONNECTED`) | API instance after its Redis subscriber reconnects | Run reconciliation (SYSTEM_DESIGN.md §5.5) |
| `session.revoked` | — (server-internal) | `user:{id}` | `sessionIds[]`, `reason` | logout-all, disable, role change, reset, password change | **Not forwarded.** Each instance closes matching sockets with code `4401`; the client goes to `/login` |

### 7.3 Ordering, versioning and de-duplication

- **Ordering:** Not guaranteed across instances. Clients apply entity patches only when `payload.version >
  cached.version`. Aggregates are refetched, not patched.
- **Duplicates:** The outbox gives at-least-once publication. Clients keep the last 1,000 `seq` values in an
  LRU set and drop repeats.
- **Versioning:** A breaking payload change introduces a new `type` (e.g. `stock.changed.v2` with GraphQL type
  `StockChangedV2Event`). Both are emitted for one release; clients ignore unknown `__typename`s.
- **Field names across event types:** `ProductChangedEvent.change` and `CategoryChangedEvent.change` have
  different enum types, so one subscription selecting both must alias them (the web client uses
  `productChange` and `categoryChange`); GraphQL validation rejects the unaliased pair.
- **Liveness and limits:** a socket may hold at most 3 subscriptions; graphql-ws reserves an id before
  `onSubscribe`, so the cap also holds for subscriptions sent together.

### 7.4 Example payloads

```json
{ "data": { "shopEvents": { "__typename": "StockChangedEvent", "seq": "48211", "type": "stock.changed",
  "schemaVersion": 1, "occurredAt": "2026-10-28T17:09:06.120Z",
  "items": [ { "productId": "0192f0c1-…", "stockPieces": 49, "isLowStock": false, "version": 8 },
             { "productId": "0192f0c4-…", "stockPieces": 4,  "isLowStock": true,  "version": 31 } ] } } }
```

```json
{ "data": { "shopEvents": { "__typename": "CustomerBalanceChangedEvent", "seq": "48212",
  "type": "customer.balanceChanged", "schemaVersion": 1, "occurredAt": "2026-10-28T17:09:06.121Z",
  "customerId": "0192e7aa-…", "balance": "2450.00", "version": 14 } } }
```

### 7.5 WebSocket protocol details

| Aspect | Value |
|---|---|
| Protocol | `graphql-transport-ws` (library `graphql-ws`) |
| Auth | Session cookie on the upgrade request, validated in `onConnect`; `Origin` must equal `WEB_ORIGIN` |
| Close codes | `4401` unauthenticated/revoked · `4403` forbidden/origin · `4429` too many connections (max 10 per user per instance) · `4400` bad message · `1012` server restarting |
| Subscriptions per socket | Max 3 (normally 1) |
| Heartbeat | Client `ping` every 20 s (`keepAlive`), server terminates sockets silent for 60 s. Protocol frames only |
| Compression | `permessage-deflate` off (events are tiny; saves CPU) |

---

## 8. Rate limits

Buckets live in `apps/api/src/infrastructure/rate-limit/buckets.ts`. Exceeding one returns `RATE_LIMITED`
(GraphQL) or HTTP 429 with `Retry-After` (REST).

| Bucket | Key | Limit | If Redis is down |
|---|---|---|---|
| `login` | username + IP | 5 / 15 min | In-memory per instance |
| `login-ip` | IP | 30 / 15 min | In-memory per instance |
| `signup-ip` | IP | 5 / 15 min | Fail closed |
| `signup-global` | all sign-up requests | 30 / 15 min | Fail closed |
| `password` | user | 5 / hour (change and reset) | In-memory per instance |
| `ws-connect` | IP | 30 / min | In-memory per instance |
| `default` | user (IP if anonymous) | 600 / min | **Fail open** (logged) |
| `sale` | user | 120 / min on `createSale` and `refundOrder` | **Fail open**, never blocks billing |
| `ai` | user | 30 / hour | In-memory per instance (ADR-049; it failed closed before 2026-11-10) |
| `export` | user | 20 / hour | In-memory per instance (ADR-049; it failed closed before 2026-11-10) |
| `import` | user | 10 / hour | In-memory per instance (uploads still stage while Redis is down, ADR-020, RED-08) |

---

## 9. REST endpoints

All REST endpoints use the same session cookie, `SessionGuard` and `PermissionGuard`. Mutating requests must
send `X-POS-CSRF: 1` (forces a preflight).

| Method and path | Permission | Behaviour |
|---|---|---|
| `POST /v1/imports/products` (multipart `file`, ≤ 5 MB, `.xlsx`/`.csv`) | catalog:import | Parses and stages rows, creates the categories they name (D-29), enqueues the job, returns `202 { importJobId }` |
| `GET /v1/imports/products/template.xlsx` | catalog:import | Template with headers and one example row |
| `GET /v1/imports/:jobId/errors.csv` | catalog:import | Failed rows with messages (streamed) |
| `GET /v1/exports/products?format=csv\|xlsx\|pdf&categoryId=&includeArchived=` | catalog:export | Streamed file, read in keyset batches of 500; its Category column names each product's category |
| `GET /v1/exports/low-stock?format=csv\|pdf` | catalog:export | Streamed file |
| `GET /health/live` | public | `200` if the process runs; touches **neither** DB nor Redis |
| `GET /health/ready` | public | `200` if Postgres answers `SELECT 1`; reports Redis as `degraded` but stays `200` (SYSTEM_DESIGN.md §6.5) |
| `GET /metrics` | `Authorization: Bearer $METRICS_TOKEN` | Prometheus text format |

Exports are explicit, user-triggered, rate-limited file downloads. They are the only operations that read
whole tables, and they do so in bounded batches.

---

## 10. Inputs and examples

### 10.1 Validation limits (`@pos/validation`)

| Field | Rule |
|---|---|
| Search text | Trimmed, 1–60 chars; name search needs ≥ 2 chars; barcode exact match any length |
| Names | 1–200 (products), 1–120 (customers, vendors, staff), 1–80 (categories) |
| Notes, descriptions | ≤ 300 |
| Money input | `0.00`–`9999999999.99`; ledger entry amounts must be > 0 |
| Quantity | Integer 1–10,000 per sale line; restock/adjust 1–1,000,000 pieces |
| Lines per sale | 1–100 (Q34); no duplicate `(productId, unit)` pairs |
| Percent | 0–100, ≤ 2 decimals |
| Password | 8–128 chars, not equal to the username |
| Username | 3–40, `[a-z0-9._-]` |

### 10.2 `createSale`

```graphql
input CreateSaleInput {
  idempotencyKey: ID!
  lines: [SaleLineInput!]!        # 1–100
  discount: DiscountInput!        # { type: NONE | FLAT | PERCENT, amount: Money, percent: Percent }
  billGst: BillGstInput!          # { applied: Boolean!, rate: Percent }  (default rate from settings)
  paymentMethod: PaymentMethod!
  customerId: ID                  # required when paymentMethod = UDHAAR (D-15)
  expectedTotal: Money!           # preview total shown to the cashier
}
input SaleLineInput {
  productId: ID!
  unit: SaleUnit!
  quantity: Int!
  discount: DiscountInput         # on this item alone, taken before the overall one (D-27)
}

type CreateSalePayload {
  order: Order!
  receipt: Receipt!               # everything needed to print, no extra request
  stockWarnings: [StockWarning!]! # products that went below zero (D-16)
  replayed: Boolean!              # true when the idempotency key matched an existing sale
}
```

```graphql
mutation CreateSale($input: CreateSaleInput!) {
  createSale(input: $input) {
    replayed
    order { id billNumber total status version }
    receipt { ...ReceiptFields }
    stockWarnings { productId productName stockAfter }
  }
}
```

Variables for the screenshot example (`#44`):

```json
{ "input": { "idempotencyKey": "0192f0d2-…",
  "lines": [ { "productId": "…a3", "unit": "PIECE", "quantity": 1 },
             { "productId": "…a4", "unit": "PIECE", "quantity": 1 },
             { "productId": "…a5", "unit": "PIECE", "quantity": 1 } ],
  "discount": { "type": "NONE" }, "billGst": { "applied": true, "rate": "18.00" },
  "paymentMethod": "CASH", "expectedTotal": "283.20" } }
```

### 10.3 Out of scope (not in FEATURES.md)

Expenses, itemised purchase orders, purchase returns, split payments, multi-branch and tenant APIs, and FBR
reporting (D-03, D-20, D-04) have **no** operations. Adding any of them requires an owner decision first.
