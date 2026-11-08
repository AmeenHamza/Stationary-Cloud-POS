# REPOSITORY_STRUCTURE.md — Proposed Repository Tree

**Status:** Proposed, awaiting owner review (design stage). **None of these files exist yet** except the documents
and `Screen Shots/`. Files are created by the phase listed in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).
**Last updated:** 2026-10-28

Conventions used below: `(gen)` = generated, never edited, excluded from size/duplication checks and
gitignored unless stated. `(P-01)` = proposed screen awaiting owner confirmation. Folder purposes are
explained in §3; dependency rules are in [ARCHITECTURE.md §6](ARCHITECTURE.md) and enforced per
[CODING_STANDARDS.md §4](CODING_STANDARDS.md).

The repository root is this folder. A future rename to `stationery-pos/` does not change the layout.

---

## 1. Root

```
.
├── .github/
│   ├── actions/setup/action.yml      # shared Node + pnpm + frozen install step
│   ├── workflows/
│   │   ├── ci.yml                    # PR + main: quality gates, unit, integration, build, e2e
│   │   ├── network-budgets.yml       # nightly + manual: perf workload, byte budgets
│   │   ├── security.yml              # weekly: pnpm audit, gitleaks (full history)
│   │   └── backup.yml                # weekly encrypted logical backup (DEPLOYMENT.md §7)
│   ├── CODEOWNERS                    # owner review for scripts/, infra/, exceptions, migrations
│   └── pull_request_template.md      # checklist mirroring CODING_STANDARDS.md §9
├── apps/
│   ├── api/                          # NestJS GraphQL API (§2.1)
│   └── web/                          # Next.js App Router frontend (§2.2)
├── packages/
│   ├── config-eslint/                # shared ESLint flat configs + restricted-syntax rules
│   ├── config-typescript/            # shared tsconfig bases
│   ├── contracts/                    # SDL snapshot, error codes, limits, permissions, event names, enums
│   ├── database/                     # Prisma schema (multi-file), migrations, TypedSQL, client
│   ├── domain/                       # pure business rules: money, bill/refund maths, units, dates, format
│   └── validation/                   # Zod input schemas shared by web and API
├── tools/
│   ├── legacy-migration/             # owner-run migration from the old Neon DB (D-21)
│   └── perf/                         # dataset generator, workload simulator, byte meters, budgets
├── e2e/                              # Playwright end-to-end + network tests (own workspace package)
├── scripts/                          # @pos/scripts workspace package: quality checks + dev helpers (tsx)
├── infra/
│   ├── docker-compose.yml            # local postgres + redis (pinned images)
│   └── redis/redis.conf              # shared Redis config (noeviction, AOF, maxmemory)
├── docs/
│   ├── EXISTING_SYSTEM_AUDIT.md      # audit of the old system (exists)
│   └── runbooks/                     # incident · restore (drill log) · rotate-secrets · first-deploy · counter-pc-setup · cutover
├── Screen Shots/                     # evidence of the old app (read-only, never modified)
├── .dependency-cruiser.cjs           # module boundary + cycle rules
├── .dockerignore                     # API image build context: no .env, node_modules, dist, .git, screenshots
├── .editorconfig
├── .env.example                      # vars for docker compose and tools only
├── .gitattributes                    # LF line endings (line counting is LF-based)
├── .gitignore                        # node_modules, dist, .next, .turbo, coverage, **/__generated__, .env*
├── .gitleaks.toml
├── .jscpd.json                       # duplicate-code thresholds and ignores
├── .npmrc                            # strict-peer-dependencies, engine-strict
├── .nvmrc                            # Node LTS major
├── .prettierignore
├── eslint.config.mjs                 # imports @pos/config-eslint
├── package.json                      # workspace scripts (CODING_STANDARDS.md §8), packageManager, engines
├── pnpm-workspace.yaml               # apps/*, packages/*, tools/*, e2e
├── prettier.config.mjs
├── renovate.json
├── tsconfig.json                     # resolution-only config for dependency-cruiser (`@/` → apps/web/src)
├── turbo.json                        # task graph: build, typecheck, lint, test, codegen, schema:emit
└── CLAUDE.md, INSTRUCTIONS.md, CODING_STANDARDS.md, ARCHITECTURE.md, REPOSITORY_STRUCTURE.md,
    SYSTEM_DESIGN.md, DATABASE.md, API.md, NETWORK_OPTIMIZATION.md, IMPLEMENTATION_PLAN.md,
    TESTING.md, DEPLOYMENT.md, DECISIONS.md, FEATURES.md
```

---

## 2. Applications

### 2.1 `apps/api` (NestJS)

```
apps/api/
├── Dockerfile                        # turbo prune → install → build → prod install; node 24 slim, non-root (ADR-032)
├── railway.json                      # Dockerfile build, pre-deploy migrate, healthcheck /health/ready, draining 45 s
├── nest-cli.json                     # tsc builder (tests use unplugin-swc)
├── package.json                      # `files: ["dist"]`
├── tsconfig.json / tsconfig.build.json
├── vitest.shared.mts                 # SWC + graphql CommonJS alias, shared by both configs
├── vitest.config.mts                 # unit (src/**/*.spec.ts)
├── vitest.integration.config.mts     # integration (real PostgreSQL + Redis, TESTING.md §2)
├── .env.example
├── src/
│   ├── main.ts                       # loads .env in development, validates config, listens
│   ├── app.module.ts                 # AppModule.forRoot(env): wires config, infrastructure, modules
│   ├── bootstrap/     configure-app.ts   # helmet, compression, cookies, body limit, CORS, filter (shared by tests)
│   ├── config/
│   │   ├── env.schema.ts             # Zod schema for every env var (DEPLOYMENT.md §4)
│   │   ├── config.module.ts          # validates at boot, fails fast
│   │   └── app-config.ts             # typed accessor (no process.env elsewhere)
│   ├── common/                       # framework-level cross-cutting code, no business rules
│   │   ├── errors/        app-error.ts · graphql-error.formatter.ts · prisma-error.mapper.ts · http-exception.filter.ts
│   │   ├── auth/          access-policy.ts (@Public/@Authenticated/@RequirePermission) · access.guard.ts (global) · principal.ts (PRINCIPAL_RESOLVER) · request-of.ts · current-viewer.decorator.ts   # ADR-033
│   │   ├── http/          request-context.ts   # client IP, user agent, request id from CLS
│   │   ├── pagination/    page.args.ts · page-info.type.ts · connection.factory.ts · cursor.codec.ts · keyset.ts
│   │   ├── graphql/       graphql.module.ts · graphql-context.ts · complexity.plugin.ts · depth-limit.rule.ts · error-reporting.plugin.ts · metrics.plugin.ts (pos_graphql_duration_seconds) · scalars.ts (Money, Percent, BusinessDate) · enums.registry.ts (Phase 5+)
│   │   ├── validation/    zod-validation.pipe.ts
│   │   ├── idempotency/   request-hash.ts · idempotent-replay.ts (Phase 9)
│   │   ├── logging/       logger.module.ts · redact-paths.ts · request-id.ts
│   │   ├── time/          clock.service.ts · sleep.ts   # injectable now(); the API's only setTimeout
│   │   └── testing/       failpoint.service.ts          # active only when NODE_ENV=test (TESTING.md §2)
│   ├── infrastructure/                # adapters to external systems, no business rules
│   │   ├── prisma/        prisma.module.ts · transactional.module.ts · transactional-client.ts · transaction-retry.ts
│   │   ├── unit-of-work/  unit-of-work.module.ts · unit-of-work.ts · after-commit.ts   # ADR-029
│   │   ├── redis/         redis.module.ts · redis.clients.ts · redis-status.ts   # 3 clients + lifecycle events
│   │   ├── cache/         cache.module.ts · cache.service.ts · cache-keys.ts · single-flight.ts
│   │   ├── rate-limit/    rate-limit.module.ts · buckets.ts · rate-limiter.service.ts · memory-window.ts   # ADR-024
│   │   ├── realtime/      realtime-infra.module.ts · outbox.repository.ts · outbox.service.ts · outbox.publisher.ts · redis-pubsub.ts · event-envelope.ts · channels.ts
│   │   ├── queue/         queue.module.ts · queue-runtime.ts (BullMQ started on Redis ready, ADR-040) · queue-names.ts · queue-connection.ts
│   │   ├── ai/            groq.module.ts · groq.client.ts (model, timeout, one 5xx retry, error codes; ADR-041)
│   │   ├── crypto/        crypto.module.ts · secret-box.ts (AES-256-GCM, nonce ‖ ciphertext ‖ tag) · secret-box.spec.ts
│   │   ├── files/         csv-stream.ts · xlsx-stream.ts · pdf-table.ts · upload-limits.ts   # Phase 11
│   │   └── metrics/       metrics.module.ts · metrics.service.ts · metrics.controller.ts
│   ├── modules/                       # one folder per business module (ARCHITECTURE.md §7.1)
│   │   ├── auth/
│   │   │   ├── auth.module.ts · index.ts · session-cookie.ts
│   │   │   ├── graphql/      auth.resolver.ts · viewer.type.ts · auth.inputs.ts
│   │   │   ├── application/  login.service.ts · logout.service.ts · change-password.service.ts · viewer.service.ts · session.service.ts (PrincipalResolver) · session-revocation.service.ts · session-token.ts · password-hasher.ts
│   │   │   └── persistence/  sessions.repository.ts · auth-users.repository.ts
│   │   ├── staff/
│   │   │   ├── staff.module.ts · index.ts
│   │   │   ├── graphql/      staff.resolver.ts · staff-user.type.ts · staff.inputs.ts
│   │   │   ├── application/  create-staff-user.service.ts · update-staff-user.service.ts · set-staff-status.service.ts · reset-staff-password.service.ts · delete-staff-user.service.ts · staff-queries.service.ts · staff-change.ts (last-admin, version) · bootstrap-admin.service.ts (CLI)
│   │   │   └── persistence/  staff.repository.ts
│   │   ├── settings/
│   │   │   ├── settings.module.ts · index.ts
│   │   │   ├── graphql/      settings.resolver.ts (+ updatedAt) · ai-key.resolver.ts (aiKeyConfigured, aiKeyLast4, set/clear) · shop-settings.type.ts
│   │   │   ├── application/  settings.service.ts · ai-key.service.ts (encrypt, last4, decrypt on use)
│   │   │   └── persistence/  settings.repository.ts · ai-key.repository.ts (the only reader of the ciphertext)
│   │   ├── catalog/
│   │   │   ├── catalog.module.ts · index.ts · catalog-events.types.ts (StockChanged, ProductChanged, CategoryChanged, LowStockCountChanged)
│   │   │   ├── categories/
│   │   │   │   ├── graphql/      category.resolver.ts · category.type.ts · category.inputs.ts
│   │   │   │   ├── application/  category-commands.service.ts · category-queries.service.ts
│   │   │   │   └── persistence/  categories.repository.ts
│   │   │   ├── products/
│   │   │   │   ├── graphql/      product-queries.resolver.ts · product-commands.resolver.ts · product.type.ts · product.inputs.ts (inputs and args)
│   │   │   │   ├── application/  create-product.service.ts · update-product.service.ts · clone-product.service.ts · archive-product.service.ts (archive + restore) · delete-product.service.ts · new-product-recorder.ts (opening movement, events, audit, replay) · product-queries.service.ts (incl. low stock) · product-data.ts · product-view.ts · product-events.ts
│   │   │   │   └── persistence/  products.repository.ts · product-list.repository.ts (keyset lists, search, low-stock filter)
│   │   │   └── inventory/
│   │   │       ├── graphql/      inventory.resolver.ts · inventory.inputs.ts · stock-movement.type.ts (P-02)
│   │   │       ├── application/  stock-ledger.service.ts · restock.service.ts · adjust-stock.service.ts
│   │   │       └── persistence/  stock.repository.ts
│   │   ├── sales/
│   │   │   ├── sales.module.ts · index.ts
│   │   │   ├── graphql/      sales.resolver.ts (createSale, saleStatus) · orders.resolver.ts (orders, order, orderReceipt, refundOrder) · order.types.ts · receipt.types.ts · sale.inputs.ts · sale-events.types.ts
│   │   │   ├── application/  create-sale.service.ts · sale-pricing.ts · refund-order.service.ts · receipt.builder.ts · order-queries.service.ts · order-view.ts · sale-events.ts
│   │   │   └── persistence/  orders.repository.ts · order-list.repository.ts · refunds.repository.ts · bill-counter.repository.ts
│   │   ├── khata/            one module for both khatas (ADR-037)
│   │   │   ├── khata.module.ts · index.ts (exports CustomersService for sales)
│   │   │   ├── ledger/       ledger-posting.service.ts (balance + entry + event + audit) · party.service.ts · party-commands.service.ts · party-queries.service.ts · party-store.ts · party-where.ts · party-errors.ts · graphql/party.types.ts
│   │   │   ├── customers/    graphql/ (customers.resolver.ts · customer-khata.resolver.ts · customer.types.ts) · application/customers.service.ts · persistence/customers.repository.ts
│   │   │   └── vendors/      (same shape as customers/)
│   │   ├── reporting/
│   │   │   ├── reporting.module.ts · index.ts
│   │   │   ├── graphql/      dashboard.resolver.ts · dashboard.types.ts
│   │   │   ├── application/  dashboard.service.ts (ranges, net amounts, money format) · insights.service.ts (AI aggregates, ≤ 50 rows) · report-format.ts
│   │   │   └── persistence/  sales-metrics.repository.ts · stock-metrics.repository.ts · insight-metrics.repository.ts · net-product-sales.ts (shared CTE)   # tagged $queryRaw (ADR-039)
│   │   ├── ai-assistant/
│   │   │   ├── ai-assistant.module.ts · index.ts
│   │   │   ├── ai-assistant.spec.ts (prompts, tools, helpers)
│   │   │   ├── graphql/      ai.resolver.ts (six mutations) · ai.types.ts (AiResult and inputs)
│   │   │   └── application/  ai-request.service.ts (limit, key, cache, audit) · ai-facts.service.ts · ai-reports.service.ts · ai-chat.service.ts · ai-tools.ts · prompt-builder.ts · ai-result-cache.ts   # ADR-041
│   │   ├── catalog-io/
│   │   │   ├── catalog-io.module.ts · index.ts
│   │   │   ├── http/         imports.controller.ts · exports.controller.ts
│   │   │   ├── http/         … · download.ts (attachment headers + writer)
│   │   │   ├── graphql/      import-jobs.resolver.ts · import-job.types.ts (ImportJob, rows, import and bulk events)
│   │   │   ├── application/  import-file.parser.ts · import-staging.service.ts · import-queue.ts · import-runner.service.ts · import-events.ts · import-queries.service.ts · import-template.ts · export-columns.ts · export-writers.ts
│   │   │   └── persistence/  import-jobs.repository.ts
│   │   │   (product writes and export reads go through catalog's ProductImportService and ProductExportReader)
│   │   ├── audit/
│   │   │   ├── audit.module.ts · index.ts
│   │   │   ├── application/  audit.service.ts · audit-actions.ts
│   │   │   ├── persistence/  audit.repository.ts
│   │   │   └── graphql/      audit.resolver.ts · audit-log.type.ts   (P-01)
│   │   ├── realtime/
│   │   │   ├── realtime.module.ts · index.ts
│   │   │   ├── graphql/      shop-events.resolver.ts (+ ResyncRequiredEvent)
│   │   │   └── application/  ws-connection.service.ts · event-audience.ts · event-stream.ts · realtime-hub.ts (resync on subscriber reconnect)
│   │   ├── server-info/      server-info.module.ts · server-info.resolver.ts   # serverInfo { version businessDate }
│   │   └── health/           health.module.ts · health.controller.ts
│   └── cli/
│       ├── emit-schema.ts             # writes packages/contracts/schema.graphql without DB/Redis
│       ├── create-admin.ts            # bootstrap the first admin account (password prompted, never an argument)
│       ├── read-secret.ts             # hidden TTY prompt / first line of piped stdin
│       ├── integrity-checks.ts        # DATABASE.md §12 checks as SQL (also run by the FIN-22 test)
│       ├── verify-integrity.ts        # `cli:verify-integrity`: runs them, bounded output, exit 1 on failure
│       ├── rotate-settings-key.ts     # `cli:rotate-settings-key`: re-encrypts the Groq key (logic: reencrypt-groq-key.ts)
│       └── revoke-all-sessions.ts     # `cli:revoke-all-sessions --confirm`: signs everyone out after a leak
└── test/
    ├── support/        global-setup.ts (template DB) · load-env.ts · services.ts · harness.ts (app + proxies, statement and DB byte counters) · app-factory.ts · graphql-client.ts · channel-listener.ts · auth.ts · roles.ts (useRoles: admin + cashier) · staff.ts · catalog.ts · khata.ts · sales.ts · property-ops.ts (FIN-22 random operations) · ws-client.ts (raw graphql-transport-ws, liveEvents probe)
    ├── auth/staff/access-policy/sessions/staff-last-admin *.int.spec.ts   # Phase 5
    ├── authorization-matrix (SEC-02, 07, 15) · sessions-reset · settings-key-rotation *.int.spec.ts   # Phase 15; support/operation-matrix.ts
    ├── catalog-(products|product-edits|stock|lists|categories).int.spec.ts · settings-events.int.spec.ts · realtime-ws.int.spec.ts   # Phase 7 + realtime
    ├── network-budgets.int.spec.ts   # NET-01 sizes, NET-02/PAG-07 statements per list, PAG-09 every connection
    ├── khata-(customers|vendors-ledger).int.spec.ts   # Phase 8
    ├── sales-(billing|idempotency|refunds|resilience|budgets).int.spec.ts · integrity.int.spec.ts   # Phase 9: FIN-08–FIN-24, RED-01/RED-11, NET-03
    ├── sales-item-discounts · khata-regenerate-bill · delete-(products|parties) · staff-delete · catalog-io-categories *.int.spec.ts   # Owner update 2026-11-08 (F-39–F-42)
    ├── reporting-dashboard.int.spec.ts   # Phase 10: hand-computed tiles, history, bounds, statements and bytes
    ├── catalog-io-(import|export|redis).int.spec.ts   # Phase 11: import, SEC-14, exports and batching, RED-08 (alone: one API per file)
    ├── http.int.spec.ts · unit-of-work.int.spec.ts · outbox.int.spec.ts · cache.int.spec.ts · rate-limit-pubsub.int.spec.ts   # Phase 4 infrastructure
    ├── integration/    <module>/*.int.spec.ts
    ├── concurrency/    sales-concurrency.int.spec.ts · refund-concurrency.int.spec.ts
    ├── realtime/       multi-instance-delivery.int.spec.ts · ws-auth.int.spec.ts
    ├── redis-failure/  sale-without-redis.int.spec.ts · outbox-drain.int.spec.ts · cache-fallback.int.spec.ts
    └── security/       authz-matrix.int.spec.ts · csrf-origin.int.spec.ts · rate-limit.int.spec.ts
```

Unit tests sit beside the code as `*.spec.ts`. Integration tests live under `test/` because they need real
PostgreSQL and Redis (TESTING.md §2).

### 2.2 `apps/web` (Next.js)

```
apps/web/
├── next.config.ts                    # security headers, output, bundle analyzer flag
├── codegen.ts                        # GraphQL Codegen client preset → src/graphql/__generated__
├── components.json                   # shadcn/ui config
├── postcss.config.mjs
├── package.json · tsconfig.json · vitest.config.ts · .env.example
├── instrumentation.ts · instrumentation-client.ts   # Sentry
├── public/                           # favicon, app icons
└── src/
    ├── app/
    │   ├── layout.tsx                # <html>, fonts, ThemeProvider, Toaster (server)
    │   ├── globals.css               # Tailwind entry, design tokens
    │   ├── page.tsx                  # renders <RoleRedirect/>
    │   ├── not-found.tsx · error.tsx · global-error.tsx
    │   ├── (auth)/login/page.tsx
    │   └── (app)/
    │       ├── layout.tsx            # <AppProviders><ViewerGate>…
    │       ├── terminal/             layout.tsx (header + CartProvider) · page.tsx (payment is a dialog, ADR-038)
    │       └── (admin)/
    │           ├── layout.tsx        # <AdminShell> + RequireRole("ADMIN")
    │           ├── dashboard/page.tsx
    │           ├── products/page.tsx · products/ProductsRoute.tsx (reads ?category)
    │           ├── categories/page.tsx (category detail = /products?category=<id>)
    │           ├── low-stock/page.tsx
    │           ├── orders/page.tsx
    │           ├── customers/page.tsx · customers/[customerId]/page.tsx
    │           ├── vendors/page.tsx · vendors/[vendorId]/page.tsx
    │           ├── staff/page.tsx · settings/page.tsx
    │           ├── ai/page.tsx · ai/[feature]/page.tsx
    │           └── activity/page.tsx (P-01)
    ├── features/                     # one folder per feature; public API via index.ts
    │   ├── auth/       components/ (LoginForm, ViewerGate, RoleRoutes: RoleRedirect + RequireRole, AccountMenu, ChangePasswordDialog) · hooks/ (useViewer + useCan, useChangePasswordForm) · graphql/auth.documents.ts · routes.ts · index.ts
    │   ├── catalog/    components/ (ProductsScreen, ProductFilters, ProductList, ProductTable, ProductRowActions, ProductDialogs, ProductFormDialog, ProductFormFields, CloneProductDialog, RestockDialog, AdjustStockDialog, CategoriesScreen, CategoryGrid, CategoryCard, CategoryFormDialog, LowStockScreen, LowStockBadge) · hooks/(useProductForm, useProductActions, useArchiveToggle, useDeleteProduct, useCategoryOptions, useDeleteCategory) · graphql/(products|categories|inventory).documents.ts · product.ts (labels) · index.ts
    │   ├── terminal/   components/ (TerminalScreen, TerminalHeader, KhataButtons, PartyModal, RefundButton, ProductPicker, ProductSearchBar, CategoryChips, ProductCards, ProductTile, ProductRows, CartPanel, CartLineRow, PaymentDialog, TotalsSummary, DiscountField, ItemDiscountField, BillGstField, PaymentMethodPicker, PendingSaleBanner, SaleCompleteDialog) · state/ (cart.types.ts, cart.reducer.ts, CartProvider.tsx, cart.storage.ts, cart-preview.ts, sale-input.ts, pending-sale.storage.ts) · hooks/ (useBarcodeScan, useCartProducts, useCartPreview, useCreateSale, useProductView, sale-sender.ts, sale-errors.ts) · graphql/(terminal|sale).documents.ts · index.ts
    │   ├── orders/     components/ (OrdersScreen, OrdersPanel, OrderFilters, OrdersTable, NewOrdersBanner, RefundDialog, RefundLinesTable) · hooks/ (useRefund, useReprint) · graphql/orders.documents.ts · order-labels.ts · index.ts
    │   ├── customers/  components/ (CustomersPanel, CustomerKhataPanel, UdhaarCustomerPicker) · hooks/(useCustomerKhata, useDeleteCustomer) · graphql/customers.documents.ts · customer-labels.ts · index.ts
    │   ├── vendors/    (same shape as customers/, without the Udhaar picker)
    │   ├── dashboard/  components/ (DashboardScreen, StatTile, StatTiles, SummaryCards, DashboardHistory (lazy chunk), MonthlySalesCard, ProductFilter, ProductRanking) · graphql/dashboard.documents.ts · dashboard-labels.ts · index.ts
    │   ├── ai/         components/ (AiHomeScreen, AiFeatureScreen, AiAnswerCard, AiReportPrint (A4), AiChatScreen, ChatConversation, AiKeyNotice, LanguagePicker, PeriodPickers, AiResultView, AiMarkdown (sanitised)) · hooks/ (useAiRequest, useAiFeature, useAiChat) · lib/ (ai-features.ts, chat-history.ts) · graphql/ai.documents.ts · index.ts
    │   ├── staff/      components/ (StaffScreen, StaffFilters, StaffList, StaffTable, CreateStaffDialog, EditStaffDialog, ResetPasswordDialog, StaffDialogs, role-options.ts) · hooks/(useStaffStatusToggle, useDeleteStaff) · graphql/staff.documents.ts · staff-user.ts · index.ts
    │   ├── settings/   components/ (SettingsScreen, ShopProfileForm, AiKeyForm, AiKeyFields) · graphql/settings.documents.ts (incl. AiKeyStatus) · index.ts
    │   ├── catalog-io/ components/ (ProductTransferActions, ImportDialog, ImportProgress, LowStockExport) · graphql/catalog-io.documents.ts · lib/upload-import.ts · index.ts (routes pass them into the catalogue screens)
    │   └── activity/   (P-01)
    ├── components/                   # feature-agnostic UI, never imports features/
    │   ├── ui/         # shadcn primitives: button, input, select, dialog, table, badge, card, dropdown-menu, command, popover, skeleton, tabs, checkbox, label, form, sonner, alert, tooltip
    │   ├── data/       CursorPager.tsx (pages + connection) · EmptyState.tsx · DataTable.tsx · TableSkeleton.tsx · SearchInput.tsx · ArchivedToggle.tsx
    │   ├── ledger/     PartyPanelHeader · PartyListView · PartyTable · PartyLedgerView · LedgerTable · KhataActions · KhataEntryDialog · PartyFormDialog · ArchiveConfirm · BalanceText · khata-labels.ts · usePartyList.ts · usePartyDeletion.ts   # shared by customers + vendors
    │   ├── receipt/    ReceiptBody.tsx · ReceiptPrint.tsx (print-only portal; terminal and order-history reprint)
    │   ├── charts/     ColumnChart.tsx · RankedBars.tsx · ChartTable.tsx · chart-scale.ts (validated palette tokens, ADR-039)
    │   ├── layout/     AdminShell.tsx (sidebar + nav links; account menu passed in) · BrandMark.tsx · PageHeader.tsx · ThemeToggle.tsx · ConnectionBanner.tsx (with realtime)
    │   ├── feedback/   FullPageSpinner.tsx · ConfirmDialog.tsx · DeleteConfirm.tsx · QueryState.tsx · ErrorState.tsx
    │   └── forms/      FormDialog.tsx · FormTextField.tsx · FormSelectField.tsx · ToggleField.tsx · QuantityStepper.tsx
    ├── graphql/
    │   ├── fragments/  product.fragments.ts · category.fragments.ts · party.fragments.ts (customers, vendors) · order.fragments.ts (orders, refund state, receipt)
    │   ├── shop-events.subscription.ts   # `change` aliased per event type (enums differ)
    │   └── __generated__/            (gen)
    ├── lib/
    │   ├── apollo/     create-apollo-client.ts (HTTP + error + reachability links) · type-policies.ts (ShopSettings singleton; productsByIds read from cache) · session-events.ts · network-status.ts
    │   ├── realtime/   ws-client.ts · backoff.ts · event-dedupe.ts · event-router.ts (aggregate signals refetch here) · event-types.ts · live-queries.ts · refetch-active.ts · reconcile.ts
    │   │   └── handlers/ versions.ts (version gate) · stock-changed.ts · product-changed.ts · category-changed.ts · balance-changed.ts · order-refunded.ts · later: import-progressed.ts
    │   │   new-orders.ts ("N new orders" count from order.created)
    │   ├── errors/     graphql-error.ts · apply-field-errors.ts · report-error.ts
    │   ├── theme/      theme.ts (choice, bootstrap script)
    │   ├── cn.ts                     # class-name merge for components/ui
    │   ├── timing/     debounce.ts (createCoalescer) · sleep.ts       # the only files allowed to call setTimeout
    │   ├── ids/        idempotency-key.ts
    │   ├── storage/    safe-local-storage.ts
    │   └── env.ts                    # Zod-validated NEXT_PUBLIC_* vars
    ├── providers/      AppProviders.tsx · ApolloAppProvider.tsx · RealtimeProvider.tsx · realtime-context.ts · ThemeProvider.tsx
    ├── hooks/          useCursorPages.ts (keyset forward/back) · useConfirmedDelete.ts · useOnlineStatus.ts · useFileDownload.ts (REST downloads with the cookie)
    └── styles/         print-receipt.css · print-receipt-items.css · print-view.css
```

The brief's suggested `types/` folder is **omitted**. Types come from GraphQL Codegen, `@pos/contracts` and
`@pos/domain`; a hand-written types folder would duplicate them.

---

## 3. Packages and tools

```
packages/contracts/   package.json · tsup.config.ts · tsconfig.json
  schema.graphql      # emitted by apps/api/src/cli/emit-schema.ts; committed; CI drift check
  src/ index.ts · errors.ts · limits.ts · permissions.ts · events.ts · enums.ts
packages/domain/      package.json · tsup.config.ts · tsconfig.json
  vitest.config.ts   # coverage gate ≥ 95 % (lines, branches, functions, statements)
  src/ index.ts · errors.ts (DomainRuleError)
       money/      decimal.ts · money.ts · allocate.ts · format.ts (formatRs)
       billing/    calculate-bill.ts · bill.types.ts · discount.ts · tax.ts
       refunds/    calculate-refund.ts · refund.types.ts
       units/      pieces.ts
       stock/      low-stock.ts
       time/       business-date.ts (Intl-based; no date library) · format-date.ts
       numbering/  bill-number.ts
       text/       normalize.ts (name keys, phone digits)
packages/validation/  package.json · tsup.config.ts · tsconfig.json
  src/ index.ts · common.ts · pagination.schemas.ts · auth.schemas.ts · staff.schemas.ts · settings.schemas.ts
       category.schemas.ts · product.schemas.ts · inventory.schemas.ts · sale.schemas.ts · refund.schemas.ts
       customer.schemas.ts · vendor.schemas.ts · ai.schemas.ts · import.schemas.ts
packages/database/    package.json · prisma.config.ts · tsconfig.json
  prisma/schema/   base.prisma · auth.prisma · catalog.prisma · sales.prisma · khata.prisma · system.prisma
  prisma/migrations/<timestamp>_<name>/migration.sql
  prisma/sql/      sales_by_month.sql · sales_by_day.sql · today_summary.sql · inventory_value.sql
                   product_ranking.sql · payment_breakdown.sql · discount_tax_summary.sql
  src/ index.ts · client.ts · generated/ (gen)
  seed/ seed-dev.ts     # small dev dataset; perf dataset lives in tools/perf
packages/config-typescript/  base.json · library.json · node.json · nestjs.json · nextjs.json · package.json
packages/config-eslint/      base.js · restricted.js · nest.js · next.js · package.json
packages/testkit/            src/ env.ts · test-database.ts (template clones; drop retries past autovacuum) · prisma-cli.ts (migrate) · tcp-proxy.ts (cut/stall/restore, client-data tap; byte counting in Phase 14) · pg-statement-counter.ts (NET-02, PAG-07) · groq-stub.ts (OpenAI-compatible Groq stub, records requests: SEC-12, E2E-14) · index.ts   # test-only

tools/legacy-migration/  package.json · tsconfig.json
  src/ main.ts (CLI: --dry-run --entity --limit) · config.ts
       legacy/   schema-map.ts   # written after the owner shares the old schema (Q27)
       steps/    categories.ts · products.ts · customers.ts · vendors.ts · ledgers.ts · orders.ts
       report/   report-writer.ts
       verify/   verify-counts.ts · verify-balances.ts · verify-stock.ts
tools/perf/              package.json · tsconfig.json · vitest.config.ts · budgets.json (§4.1–§4.3)   # perf-report/ is git-ignored
  src/ run.ts (CLI) · config.ts (dataset and workload, §8.1–8.2) · random.ts (seeded) · perf.test.ts
       dataset/   generate-dataset.ts · catalog-rows.ts · insert-catalog.ts · history-sql.ts (12 months in SQL)
       scenarios/ day-simulation.ts · open-day.ts · counter-session.ts · admin-session.ts · operations.ts (the web's generated documents)
       measure/   pg-byte-proxy.ts · api-server.ts (built API behind the proxy) · http-client.ts · ws-bytes.ts · redis-stats.ts
       report/    metrics.ts · budget-check.ts · report-writer.ts

e2e/   package.json · playwright.config.ts
  tests/ auth.spec.ts · staff.spec.ts · catalog.spec.ts · realtime.spec.ts · khata.spec.ts
         billing.spec.ts (E2E-02, 03, 06, NET-07) · billing-resilience.spec.ts (E2E-08, 09) · refunds.spec.ts (E2E-04)
         counter-tools.spec.ts (E2E-15, 16, 17) · delete.spec.ts (E2E-18, 19, 20)
         dashboard.spec.ts (E2E-13) · import.spec.ts (E2E-12) · ai.spec.ts (E2E-14) · network.spec.ts (NET-04, NET-05) · security-headers.spec.ts (STG-03, local part)
  fixtures/ users.ts · auth.fixture.ts · catalog.fixture.ts · billing.fixture.ts (print stub, counters) · network.fixture.ts (request meter, CDP load bytes)
            realtime.fixture.ts (the Groq stub is `@pos/testkit` groq-stub, started by `scripts/start-api.ts` on port 4199)
  scripts/ start-api.ts (fresh e2e database, seeded users, built API on :4100)

scripts/  package.json · tsconfig.json · vitest.config.ts
          check-file-size.ts · check-no-polling.ts · check-graphql-pagination.ts · check-prisma-take.ts
          check-schema-drift.ts · check-deps.ts · file-size.config.json · pagination-allowlist.json
          lib/ (count-lines.ts, walk-files.ts, repo.ts, report.ts) · dev/services-up.ts
          __tests__/ (each checker's tests build violating samples in temp dirs; nothing violating is committed)
```

---

## 4. Directory responsibilities

| Directory | Belongs here | Does **not** belong here | May be imported by |
|---|---|---|---|
| `packages/contracts` | Cross-app constants and the SDL snapshot: error codes, limits (page size 50, max lines), permissions, event names, shared enums | Logic, Zod schemas, React/Nest code | Everything |
| `packages/domain` | Pure, deterministic business rules used by both apps: money, bill/refund maths, units, business dates, formatting | I/O, framework imports, GraphQL types, env access | web, api, tools |
| `packages/validation` | Zod schemas for every mutation input, filter and import row | Business calculations, DB lookups | web, api |
| `packages/database` | Prisma schema files, migrations, TypedSQL files, generated client export, dev seed | Business logic, repositories | api (`persistence/`, `infrastructure/prisma/`), tools/legacy-migration |
| `apps/api/src/common` | Guards, decorators, error mapping, pagination primitives, scalars, validation pipe, logging | Feature logic, Prisma queries | api modules, infrastructure |
| `apps/api/src/infrastructure` | Adapters: Prisma, Redis, cache, rate limit, outbox/Pub/Sub, queue, Groq client, crypto, files, metrics | Feature-specific rules | api modules |
| `apps/api/src/modules/<m>/graphql` | Resolvers, ObjectTypes, InputTypes, Args | Prisma, Redis, calculations | its own module only |
| `apps/api/src/modules/<m>/application` | Use-case services, transactions, outbox events, audit calls, event builders | Prisma calls (use repositories), GraphQL decorators | its resolvers; other modules via `index.ts` |
| `apps/api/src/modules/<m>/persistence` | Repositories with explicit `select`, keyset queries | Events, cache, authorization | its own module's `application/` |
| `apps/web/src/app` | Route files only: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx` that compose feature screens | Data fetching logic, business UI | — |
| `apps/web/src/features/<f>` | Screens, feature components, feature hooks, GraphQL documents | Generic UI primitives (go to `components/`) | `app/`, other features via `index.ts` only |
| `apps/web/src/components` | Feature-agnostic UI (shadcn primitives, DataTable, pager, ledger table, layout, forms) | Feature imports, GraphQL documents | features, app |
| `apps/web/src/graphql/fragments` | One fragment per entity view shape, reused by all operations | Operations | features |
| `apps/web/src/lib` | Non-UI infrastructure: Apollo setup, realtime, errors, timing, ids, storage, env | React components, feature imports | everything in web |
| `apps/web/src/providers` | Context providers composed in `(app)/layout.tsx` | Screens | app layouts |
| `tools/*` | Owner-run or CI-run programs outside the deployed apps | Code imported by apps | — |
| `scripts/` | Repository quality checks | Application code | — |

---

## 5. How reuse is enforced and cycles prevented

1. **Single home rule:** each concern has exactly one home (table above). Reviewers reject a second
   implementation. `jscpd` fails CI on duplicated blocks (CODING_STANDARDS.md §3).
2. **Public entry points:** API modules expose only `index.ts` (Nest module + public services). Web features
   expose only `index.ts`. dependency-cruiser forbids deep imports across modules and features.
3. **Layer direction:** `graphql → application → persistence → infrastructure` in the API;
   `app → features → components/lib` in the web app. Reverse imports fail CI.
4. **Acyclic module graph:** the allowed API module edges are listed in ARCHITECTURE.md §7.1; any other
   edge, or a cycle, fails `check:deps`.
5. **Shared versus local:** code moves to a `packages/*` package only when **both** apps (or an app and a
   tool) need it. Code used by two features of one app goes to that app's `components/`, `lib/` or `hooks/`.
   Code used by one feature stays in that feature.
6. **Generated over hand-written:** GraphQL operation types come from Codegen; DB types come from Prisma;
   there are no parallel hand-written interfaces.
