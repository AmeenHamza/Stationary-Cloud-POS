# Old POS → new POS: schema analysis and data mapping

Phase 1 of the legacy migration (F-36, D-21, IMPLEMENTATION_PLAN.md Phase 13). Read-only analysis: no row
in either database was changed, and no application code or schema was changed.

| | |
|---|---|
| Analysed | 2026-11-10, from the live old database (read-only session) and the new database (read-only session) |
| Old database | The old system's Neon project (another Neon account), database `neondb`, PostgreSQL 18.6, 11 MB |
| New database | The new system's Neon project, database `neondb`, PostgreSQL 18.6, 10 of 10 Prisma migrations applied, business tables empty |
| Personal data | None was printed or copied: only names of tables and columns, counts, value patterns and sums |
| Owner decisions | Q41–Q44 answered 2026-11-10, all as proposed (§12) |
| Engine | Built, rehearsed, and run into production on 2026-11-10: 36 of 36 checks passed, `verify` valid (VALIDATION.md §3) |

The old system is **still in use**: its latest bill was created on 2026-11-09 at 22:23 Pakistan time. Every
count and sum below is a snapshot and will grow until the old system stops billing (§11).

---

## 1. Technology on each side

| | Old system | New system |
|---|---|---|
| Application code | Not available (D-01) | This repository |
| Database access | Unknown ORM. The `ix_<table>_<column>` index names, `hashed_password`, untyped `varchar` and `double precision` money suggest Python with SQLAlchemy (inference, not confirmed) | Prisma 7 (`packages/database/prisma/schema/*.prisma`, hand-written SQL in `prisma/migrations`) |
| Keys | `integer` serial ids | UUID (v7 by default) for main records; `bigserial` for ledger entries, lines and movements |
| Money | `double precision` (binary floating point) | `numeric(12,2)`; all money maths in `@pos/domain` |
| Codes (status, method, type) | Free `varchar` text, no enums, no CHECKs | PostgreSQL enums plus CHECK constraints |
| Timestamps | `timestamp with time zone` everywhere (no naive timestamps) | `timestamptz(3)`; business dates in Asia/Karachi |
| Integrity | Primary keys, a few foreign keys, unique indexes. No CHECK constraints, triggers, views or functions | Foreign keys, CHECKs that enforce bill arithmetic, ledger signs and refund limits, partial unique indexes |
| Migration tool | — | `tools/legacy-migration` (TypeScript, `pg`, `@pos/domain`). Transforms exist; the CLI, writer and verifier do not yet |

---

## 2. Old database: complete inventory

Two schemas: `public` (the POS) and `neon_auth` (Neon Auth's own tables: 9 tables, all empty except one
`project_config` row). `neon_auth` is not POS data and is not migrated. No enums, views, triggers, functions,
row-level policies or extensions besides `plpgsql`.

### 2.1 Tables (snapshot 2026-11-10)

| Table | Rows | Highest id ever | Primary key | Foreign keys | Unique indexes | Other indexes |
|---|---:|---:|---|---|---|---|
| `categories` | 24 | 44 | `id` | — | `name` | `id` |
| `products` | 2,950 | 4,005 | `id` | `category_id → categories` | `barcode` | `id`, `name` |
| `customers` | 31 | 32 | `id` | — | `phone` | `id`, `name` |
| `vendors` | 19 | 25 | `id` | — | `phone` | `id`, `name` |
| `customer_transactions` | 157 | 159 | `id` | `customer_id → customers`, `order_id → orders`, `created_by → users` | — | `id`, `customer_id` |
| `vendor_transactions` | 67 | 78 | `id` | `vendor_id → vendors`, `created_by → users` | — | `id`, `vendor_id` |
| `orders` | 512 | 1,797 | `id` | `customer_id → customers`, `cashier_id → users` | `order_number`, `fbr_irn` | `id` |
| `order_items` | 1,204 | 3,654 | `id` | `order_id → orders`, `product_id → products` | — | `id` |
| `order_payments` | 512 | 1,797 | `id` | `order_id → orders` | — | `id` |
| `users` | 2 | 2 | `id` | — | `username`, `email` | `id` |
| `system_settings` | 2 | 2 | `id` | — | `key` | `id` |

Every foreign key uses the default `NO ACTION`. Apart from `id`, every column allows NULL.

### 2.2 Columns

| Table | Columns (type) |
|---|---|
| `categories` | `id` int · `name` varchar · `description` varchar · `icon` varchar · `created_at` timestamptz |
| `products` | `id` int · `barcode` varchar · `name` varchar · `name_urdu` varchar · `description` varchar · `price` float8 · `cost` float8 · `stock` int · `low_stock_threshold` int · `low_stock_threshold_unit` varchar · `tax_rate` float8 · `base_unit_name` varchar · `pieces_per_box` int · `box_price` float8 · `expiry_date` date · `expiry_alert_days` int · `category_id` int · `is_active` bool · `created_at` timestamptz · `updated_at` timestamptz |
| `customers` | `id` int · `name` varchar · `phone` varchar · `email` varchar · `loyalty_points` int · `total_purchases` float8 · `created_at` timestamptz · `address` varchar |
| `vendors` | `id` int · `name` varchar · `phone` varchar · `email` varchar · `address` varchar · `products` varchar · `created_at` timestamptz |
| `customer_transactions` | `id` int · `customer_id` int · `type` varchar · `amount` float8 · `description` varchar · `payment_method` varchar · `order_id` int · `created_by` int · `created_at` timestamptz |
| `vendor_transactions` | `id` int · `vendor_id` int · `type` varchar · `amount` float8 · `description` varchar · `payment_method` varchar · `created_by` int · `created_at` timestamptz |
| `orders` | `id` int · `order_number` varchar · `created_at` timestamptz · `total_amount` float8 · `discount_amount` float8 · `discount_type` varchar · `discount_value` float8 · `discount_reason` varchar · `tax_amount` float8 · `bill_gst_enabled` bool · `bill_gst_percentage` float8 · `bill_gst_amount` float8 · `net_amount` float8 · `payment_method` varchar · `status` varchar · `refunded_amount` float8 · `customer_id` int · `cashier_id` int · `fbr_irn` varchar · `fbr_qr_code` varchar · `is_synced_with_fbr` bool · `notes` varchar |
| `order_items` | `id` int · `order_id` int · `product_id` int · `product_name` varchar · `quantity` int · `unit_price` float8 · `discount` float8 · `tax_amount` float8 · `total` float8 · `sale_unit` varchar · `pieces_per_unit` int · `refunded_quantity` int |
| `order_payments` | `id` int · `order_id` int · `payment_method` varchar · `amount` float8 |
| `users` | `id` int · `full_name` varchar · `username` varchar · `email` varchar · `hashed_password` varchar · `role` varchar · `is_active` bool · `phone` varchar · `created_at` timestamptz |
| `system_settings` | `id` int · `key` varchar · `value` varchar · `updated_at` timestamptz |

### 2.3 Code values found in the data

| Column | Values (rows) |
|---|---|
| `orders.payment_method` | cash 452 · udhaar 28 · card 23 · easypaisa 5 · bank_transfer 4 |
| `order_payments.payment_method` | Same counts as the bill: exactly one payment per bill, same method, amount = `net_amount` |
| `orders.status` | completed 488 · refunded 21 · partially_refunded 3 |
| `orders.discount_type` | NULL 421 (all with 0 discount) · flat 89 (83 above 0, 6 at 0) · percentage 2 |
| `orders.bill_gst_enabled` / `bill_gst_percentage` | false / 0 on all 512 |
| `orders.is_synced_with_fbr` | true on all 512; every bill has an `fbr_irn` (pattern `AAA-AA-99999999-XXXXXXXX-9999`) and a 67-character `fbr_qr_code` |
| `order_items.sale_unit` / `pieces_per_unit` | piece / 1 on all 1,204 |
| `customer_transactions.type` | debit 134 · credit 23 |
| `customer_transactions.payment_method` | NULL 139 · cash 13 · easypaisa 4 · card 1 |
| `vendor_transactions.type` | purchase 34 (never a method) · payment 33 (always a method: cash 27, bank_transfer 5, easypaisa 1) |
| `products.low_stock_threshold_unit` | piece 2,947 · box 3 |
| `products.base_unit_name` | Piece on all 2,950 |
| `products.is_active` | true on all 2,950 |
| `products.tax_rate` | 0 on all 2,950 |
| `products.pieces_per_box` | 1 (2,927) · 12 (17) · 10 (5) · 20 (1) |
| `users.role` | admin 1 · cashier 1 |
| `system_settings.key` | `bill_gst_percentage` (value 18.0) · `groq_api_key` (a secret; its value was not read) |

### 2.4 How the old app stored a bill (checked on every row)

- `order_items.total` = `unit_price × quantity` (the line before any discount or tax) on all 1,204 items.
- `orders.total_amount` = Σ item totals; `orders.tax_amount` = Σ item `tax_amount`.
- `orders.net_amount` = `total_amount − discount_amount + tax_amount + bill_gst_amount` on all 512 bills,
  and equals the bill's one payment.
- A percentage discount is `total_amount × discount_value / 100` (both bills); a flat one has
  `discount_amount = discount_value`.
- No item ever had its own discount (`order_items.discount` = 0 everywhere).
- Product tax: 3 items on 3 bills (1720, 1724, 1785), each 13 % of the item's price, Rs 62.40 in total. On
  bill 1785 the old app charged it on the price **before** the bill discount; the new rule is discount first
  (D-08). The migration keeps the amount that was charged.
- Refunds: a full refund has `refunded_amount = net_amount` with every item fully refunded. A partial refund
  is the refunded items' price less their share of the bill discount (all 3 match). The old app has no
  refund table, so **the date of a refund is not recorded**.
- Udhaar: each of the 28 Udhaar bills has a customer and exactly one `debit` khata entry at the same instant
  for the same amount. The one refunded Udhaar bill also has a `credit` entry for the refund.

---

## 3. New database: the tables the migration writes

Full definitions: DATABASE.md §4 and `packages/database/prisma/schema`. The rules below decide how old data
must be shaped.

| Table | Key and identity | Rules that matter for migration |
|---|---|---|
| `categories` | uuid; `legacy_id` unique | `name` citext unique (ignoring case), 1–80 characters; `description` ≤ 200; `icon_emoji` ≤ 16 |
| `products` | uuid; `legacy_id` unique | `name` 1–200; barcode ≤ 64 and unique among active products (exact match); `legacy_barcode` ≤ 128; prices ≥ 0; `box_price` only when `pieces_per_box` > 1; tax 0–100; threshold ≥ 0. Names need not be unique |
| `stock_movements` | bigserial | Σ movements = `products.stock_pieces` (integrity check). `MIGRATION` type: any non-zero quantity |
| `customers`, `vendors` | uuid; `legacy_id` unique | `name` 1–120; phone ≤ 30 (not unique); `balance` = Σ ledger amounts; negative balance (advance) allowed |
| `customer_ledger_entries` | bigserial; `legacy_id` unique | Sign by type: `CREDIT_SALE`, `MANUAL_CREDIT` > 0; `PAYMENT`, `REFUND_CREDIT` < 0; `OPENING_BALANCE` ≠ 0. **A payment method is required on `PAYMENT` and forbidden on every other type**, and is never UDHAAR. `CREDIT_SALE` needs its bill and `REFUND_CREDIT` its refund, each linked once |
| `vendor_ledger_entries` | bigserial; `legacy_id` unique | `PURCHASE` > 0 without a method; `PAYMENT` < 0 with a method |
| `orders` | uuid; `legacy_id` unique; `idempotency_key` unique | `bill_number` unique (a migrated bill may keep any format); `total = subtotal − discount_total + product_tax_total + bill_gst_amount`; discount `NONE` needs value 0; Udhaar needs a customer; status must agree with `refunded_total`; `cashier_id` NULL for migrated bills (A-07) with `cashier_name` kept as text |
| `order_lines` | bigserial; unique (bill, line_no) | line_no 1–100; `line_gross = unit_price × quantity`; `line_net = line_gross − line_discount`; `0 ≤ item_discount ≤ line_discount ≤ line_gross`; `product_id` may be NULL (a custom item) |
| `refunds`, `refund_lines` | uuid / bigserial | amount > 0; settlement `KHATA_CREDIT` exactly when the method is UDHAAR; Σ refunds = `orders.refunded_total`; Σ refunded line quantities = `refunded_quantity` |
| `bill_number_counters` | business date | `last_value` = the highest bill number of each date, so new bills on that date continue after it |
| `shop_settings` | singleton | `default_bill_gst_rate` 0–100 |

`users`, `sessions`, `import_*`, `outbox_events` and `audit_logs` receive no migrated rows (§7).

---

## 4. Table mapping

| Old table | New table(s) | Kind |
|---|---|---|
| `categories` | `categories` | Direct |
| `products` | `products` + one `stock_movements` row (`MIGRATION`) per product with stock ≠ 0 | Split: the stock balance becomes a ledger movement |
| `customers` | `customers` (balance derived from the ledger) | Direct, minus loyalty fields (§12) |
| `vendors` | `vendors` | Renamed column `products` → `products_supplied` |
| `customer_transactions` | `customer_ledger_entries` | Re-typed: debit/credit → five entry types, signed amounts, running balance |
| `vendor_transactions` | `vendor_ledger_entries` | Re-typed: purchase/payment, signed amounts, running balance |
| `orders` | `orders` + `refunds` (one per refunded bill) + `bill_number_counters` | Split |
| `order_items` | `order_lines` + `refund_lines` | Split: refunded quantities become refund lines |
| `order_payments` | — (merged into `orders.payment_method`) | Merged: one payment per bill, used only as a check |
| `users` | — (`orders.cashier_name` text only) | Not migrated (A-07) |
| `system_settings` | `shop_settings.default_bill_gst_rate` (§12); Groq key not migrated | Partly |
| `neon_auth.*` | — | Not POS data |
| — | `audit_logs`, `outbox_events`, `sessions`, `import_*` | New-system only; nothing to migrate |

Not in the old database at all, so there is nothing to migrate: stock history (old movements were never
stored), purchase invoices or purchase items (purchases are vendor khata amounts only, D-20), expenses,
split payments, and bills from before 30 October 2026 (§9.1).

---

## 5. Column mapping

Old ids become new UUIDs computed from the old id (§8). Every row that has a `legacy_id` column gets the old
id there as text. "—" means not migrated.

### 5.1 Categories (24)

| Old | New | Rule |
|---|---|---|
| `id` | `id`, `legacy_id` | UUID from `category:<id>`; old id as text |
| `name` | `name` | Trimmed. No two old names differ only by case, so none merge |
| `description` | `description` | Empty on all 24 |
| `icon` | `icon_emoji` | Empty on all 24 |
| `created_at` | `created_at`, `updated_at` | Kept |
| — | `version` | 1 |

### 5.2 Products (2,950) and opening stock

| Old | New | Rule |
|---|---|---|
| `id` | `id`, `legacy_id` | UUID from `product:<id>` |
| `barcode` | `barcode` / `legacy_barcode` | Trimmed (38 have spaces at the start or end, which would never match a scan). Over 64 characters (2) → `legacy_barcode` and no barcode. A barcode equal to an earlier product's after trimming (1 pair) → `legacy_barcode` on the later product (Q35). 166 have none |
| `name` | `name`, `name_key` | Trimmed; `name_key` via `@pos/domain` `normalizeNameKey` |
| `name_urdu` | `name_urdu` | Empty on all |
| `description` | — | Empty on all 2,950; the new product has no description |
| `category_id` | `category_id` | Through the category map; 21 have none (Uncategorised) |
| `base_unit_name` | `base_unit_label` | "Piece" on all |
| `pieces_per_box` | `pieces_per_box` | 1–20, all valid |
| `price` | `sale_price` | Rounded to the paisa (none has more than 2 decimals) |
| `box_price` | `box_price` | Empty on all |
| `cost` | `cost_price` | 10 empty → NULL (not invented) |
| `tax_rate` | `tax_rate` | 0 on all |
| `low_stock_threshold`, `low_stock_threshold_unit` | `low_stock_threshold_pieces`, `low_stock_threshold_unit` | Box thresholds (3 products) × pieces per box; piece thresholds as they are |
| `stock` | `stock_pieces` + `stock_movements` | Pieces as they are (none negative). Products with stock ≠ 0 get one `MIGRATION` movement for the whole balance, so Σ movements = stock |
| `expiry_date`, `expiry_alert_days` | — | Empty on all; the new system has no expiry |
| `is_active` | `archived_at` | All active → NULL |
| `created_at`, `updated_at` | `created_at`, `updated_at` | Kept |

### 5.3 Customers (31) and vendors (19)

| Old | New | Rule |
|---|---|---|
| `id` | `id`, `legacy_id` | UUID from `customer:<id>` / `vendor:<id>` |
| `name` | `name`, `name_key` | Trimmed (longest 27 characters) |
| `phone` | `phone`, `phone_digits` | As stored; digits only for search. No two phones collide after removing spaces and dashes |
| `email`, `address` | `email`, `address` | Empty on all |
| `vendors.products` | `vendors.products_supplied` | 1 vendor has it |
| `customers.loyalty_points` | — | 20 customers have points. The new system has no loyalty points, so they are not migrated (Q41) |
| `customers.total_purchases` | — | Derived; the new system computes purchases from bills. Only 13 of 22 match the bills still in the old database (§9.1) |
| (ledger) | `balance` | Σ of the migrated entries, written after them |
| `created_at` | `created_at`, `updated_at` | Kept |

### 5.4 Customer khata (157 entries)

Old `debit` raises what the customer owes; `credit` lowers it. New amounts are signed: + owes more, − owes
less. Entries are written per customer in time order with a running `balance_after`; no two entries of one
customer share a timestamp, and id order matches time order.

| Old entry | Count | Amount | New type | Rule |
|---|---:|---:|---|---|
| debit linked to the customer's Udhaar bill | 28 | 18,687.00 | `CREDIT_SALE` | `order_id` = the migrated bill |
| debit with no bill | 106 | 250,031.00 | `MANUAL_CREDIT` | 100 are from before 30 Oct (their bills were deleted in the old app, §9.1), 6 are manual Udhaar after it. Description kept as the note |
| credit linked to a refunded Udhaar bill | 1 | 460.00 | `REFUND_CREDIT` | `refund_id` = that bill's migrated refund |
| credit with a payment method | 18 | 110,275.00 | `PAYMENT` | cash 13, easypaisa 4, card 1 |
| credit with no method and no bill | 4 | 6,225.00 | `PAYMENT` | A payment needs a method in the new system: recorded as Cash and listed in the report (Q42) |

| Old | New | Rule |
|---|---|---|
| `id` | `legacy_id` | The entry's own id is a new bigserial |
| `amount` | `amount` | Signed as above; no zero or negative old amounts |
| `description` | `note` | ≤ 300 characters |
| `payment_method` | `payment_method` | Only on `PAYMENT` |
| `created_by` | — | `actor_user_id` NULL (users are not migrated) |
| `created_at` | `created_at`, `business_date` | Kept; business date in Asia/Karachi |

### 5.5 Vendor khata (67 entries)

| Old entry | Count | Amount | New type |
|---|---:|---:|---|
| purchase | 34 | 1,235,116.00 | `PURCHASE` (+, no method) |
| payment | 33 | 229,500.00 | `PAYMENT` (−, method: cash 27, bank_transfer 5, easypaisa 1) |

Other columns as in §5.4.

### 5.6 Bills (512)

| Old | New | Rule |
|---|---|---|
| `id` | `id`, `legacy_id`, `idempotency_key` | UUIDs from `order:<id>` and `order-key:<id>` |
| `order_number` | `bill_number` | Kept. Format `ORD-YYYYMMDD-NNN`, the same as new bills |
| `created_at` | `created_at`, `business_date` | Kept; the date in the bill number matches the Pakistan date on all 512 |
| `total_amount` | `subtotal` | Σ line gross |
| `discount_type`, `discount_value` | `discount_type`, `discount_value` | NULL → `NONE` (value 0); flat → `FLAT`; percentage → `PERCENT` |
| `discount_amount` | `discount_total` | = Σ line discounts (§5.7) |
| — | `item_discount_total` | 0 (no old item discounts) |
| `tax_amount` | `product_tax_total` | Σ line tax |
| `bill_gst_enabled`, `bill_gst_percentage`, `bill_gst_amount` | `bill_gst_rate`, `bill_gst_amount` | Off on all: rate NULL, amount 0 |
| `net_amount` | `total` | Must equal the recomputed total (it does on all 512) |
| `payment_method` | `payment_method` | cash/card/easypaisa/bank_transfer/udhaar → enum |
| `refunded_amount` | `refunded_total` | Kept; + one refund record (§5.8) |
| `status` | `status` | Derived from `refunded_total`; agrees with the old status on all 512 |
| `customer_id` | `customer_id` | Set on the 28 Udhaar bills only |
| `cashier_id` | `cashier_name` | The old user's `full_name`; `cashier_id` NULL (A-07) |
| `discount_reason` | — | 1 bill has one; the new bill has no field for it (§7) |
| `notes` | — | Empty on all |
| `fbr_irn`, `fbr_qr_code`, `is_synced_with_fbr` | — | FBR is out of scope (D-03); §7 |
| `order_payments.*` | — | Checked only: one payment per bill, same method and amount |
| — | `version` | 1 |

### 5.7 Bill lines (1,204)

| Old | New | Rule |
|---|---|---|
| `id` | — | `line_no` = position in the bill by old item id (at most 15 per bill) |
| `product_id` | `product_id` | Through the product map. 79 items on 69 bills have none (the product was deleted later, or a custom item) and stay custom lines with their name |
| `product_name` | `product_name` | The name printed at the sale (1 product has been renamed since) |
| — | `product_name_urdu`, `barcode` | NULL: the old app did not record them on the sale |
| `sale_unit`, `pieces_per_unit` | `sale_unit`, `pieces_per_unit` | All piece / 1 |
| `quantity`, `unit_price` | `quantity`, `unit_price` | Kept (largest quantity 462) |
| `total` | `line_gross` | = unit price × quantity |
| `discount` | `item_discount` | 0 on all |
| `orders.discount_amount` | `line_discount` | The bill discount spread over the lines in proportion to their amounts, largest remainder (`@pos/domain` `allocate`), as new bills are. Σ = the bill's discount |
| `tax_amount` | `line_tax`, `tax_rate` | Tax rounded to the paisa (stored as e.g. 15.600000000000001). The rate is read from the item (13.00 on the 3 taxed items), not from today's product, which is now 0 |
| `refunded_quantity` | `refunded_quantity` | Kept (38 items) |

### 5.8 Refunds (24 bills: 21 full, 3 partial; Rs 14,110.88)

| Field | Rule |
|---|---|
| One `refunds` row per refunded bill | UUID from `refund:<bill id>`; `idempotency_key` from `refund-key:<bill id>` |
| `amount` | The bill's `refunded_amount` |
| `bill_gst_share` | 0 (no Bill GST on any old bill) |
| `settlement`, `payment_method` | Udhaar bill → `KHATA_CREDIT` / UDHAAR (1); otherwise `ORIGINAL_METHOD` with the bill's method |
| `refund_lines` | One per refunded item: its refunded quantity, and the refund amount spread over those items by value (Σ = refund amount) |
| `created_at`, `business_date` | Not recorded in the old app. The Udhaar refund takes the date of its khata credit; the other 23 take their bill's date (Q43) |
| `reason`, `actor_user_id` | NULL |
| Stock | No refund movement: stock comes from the current balance (§5.2) |

### 5.9 Bill number counters and settings

| Old | New | Rule |
|---|---|---|
| Highest `ORD-YYYYMMDD-NNN` per date | `bill_number_counters` | One row per date (11 dates). Numbers are 1..N with no gaps on every date |
| `system_settings` `bill_gst_percentage` = 18.0 | `shop_settings.default_bill_gst_rate` | Not written: the new setting (0.00) is kept, and the report shows the old 18.0 (Q44) |
| `system_settings` `groq_api_key` | — | Not migrated. The admin enters the key in Settings, where it is stored encrypted (§7) |

---

## 6. Write order

All foreign keys point backwards in this order, so there are no circular dependencies:

1. `categories`
2. `products`, then their `MIGRATION` stock movements
3. `customers`, `vendors` (balance 0 at first)
4. `orders`, then `order_lines`
5. `refunds`, then `refund_lines`
6. `customer_ledger_entries` (need bills and refunds), `vendor_ledger_entries`
7. `customers.balance`, `vendors.balance` = Σ their entries
8. `bill_number_counters` (`shop_settings` is not changed, Q44)

The one self-reference in the new schema (`products.cloned_from_id`) is not used by migrated rows.

---

## 7. Not migrated, and why

| Old data | Rows | Why | Where it stays |
|---|---:|---|---|
| FBR invoice number, QR code, sync flag | 512 bills | FBR reporting is out of scope (D-03); the new bill has no FBR fields | The old database and its final backup (keep it: these are tax references) |
| Loyalty points | 20 customers | No loyalty feature in the new system (Q41) | Old database |
| `total_purchases` | 22 customers | Derived; recomputed from bills | — |
| Discount reason | 1 bill | No field on the new bill | Old database |
| Users and password hashes | 2 | A-07: the admin recreates staff; old hashes are not reused | Bills keep `cashier_name` |
| Who created each khata entry | 224 | Users are not migrated | — |
| Groq API key | 1 | A secret: it is never copied between systems; the admin enters it in Settings | — |
| `order_payments` rows | 512 | Same as each bill's method and total | — |
| `neon_auth` schema | 1 row | Neon's own configuration | — |
| Product description, expiry, Urdu name; category icon and description; customer email and address | — | Empty in every row | — |

---

## 8. Identity, idempotency and duplicates

- **New ids** are UUIDs computed from the entity and the old id (`legacyUuid` in
  `src/transform/values.ts`). The same old row always gets the same new id, so a re-run inserts nothing
  twice and the old-to-new id map can be rebuilt at any time. The report also writes it to a CSV file.
- **`legacy_id`** (old id as text) is on categories, products, customers, vendors, both ledgers and orders,
  each with a unique index. Lines, refunds and refund lines are unique by (bill, line number), by the refund's
  idempotency key, and by (refund, line).
- **Inserts** use `ON CONFLICT DO NOTHING` on those keys. A row that is already there is compared with what
  the old data says, and any difference is reported; it is never overwritten.
- **Target not empty:** before writing, the tool counts business rows **without** a `legacy_id`. If there are
  any, it stops: merging old bills into a system that already has new bills, products or khata entries
  needs its own plan (bill numbers, barcodes, balances). Today there are none.

---

## 9. Data findings

### 9.1 Bills before 30 October 2026 were deleted in the old app

Bills start at `ORD-20261030-001`, but bill ids go up to 1,797 and item ids to 3,654 while only 512 bills and
1,204 items remain. The old app's "delete order history before a date" feature (EXISTING_SYSTEM_AUDIT.md R2)
explains it. Those bills cannot be recovered from this database. The khata kept its entries: 100 Udhaar debits
from before 30 October (Rs 219,721) have lost their bills and are migrated as manual credit entries, so every
balance stays correct. If the owner has a Neon backup or branch from before the deletion, older bills could be
recovered from it in a separate run.

### 9.2 Other findings

| Finding | Count | Handling |
|---|---:|---|
| Barcodes with spaces at the start or end | 38 | Trimmed |
| Barcodes longer than 64 characters | 2 (longest 101) | `legacy_barcode` (Q35) |
| Barcodes that collide once trimmed | 1 pair | Later product: `legacy_barcode` (Q35) |
| Barcodes containing words (shop codes, not EAN) | 967 | Kept: the new system accepts any text up to 64 characters, and a scan is an exact match |
| Products sharing a name (ignoring case) | 605 in 185 groups (largest 35), mostly different prices | Kept: names need not be unique |
| Products without a cost price | 10 | NULL, not invented |
| Bill items whose product no longer exists | 79 on 69 bills | Custom lines with their printed name; 31 names match a current product, but they are not linked by guess |
| Product tax charged before the bill discount | 1 bill (1785) | Kept as charged |
| Flat discount of Rs 0 | 6 bills | `FLAT` with value 0, as recorded |
| Customer with an advance (negative balance) | 1 (Rs −70) | Allowed (Q25) |
| Money with more than 2 decimals | 3 tax values (float error) | Rounded to the paisa; Σ unchanged at 62.40 |
| Implausible stock or prices (Q19) | 0 (no negative stock, none over 100,000 pieces or Rs 1,000,000) | — |
| Bill with more than 100 lines (Q34) | 0 | — |
| Orphan rows, NULL keys, broken links | 0 | — |

### 9.3 Baseline for validation (snapshot; Phase 4 re-reads at run time)

| Measure | Old database |
|---|---:|
| Bills | 512 (October 83, November 429) |
| Net sales Σ `net_amount` | Rs 484,537.40 (October 77,079.00; November 407,458.40) |
| Discounts | Rs 15,314.00 |
| Product tax | Rs 62.40 |
| Refunded | Rs 14,110.88 (October 1,000.00; November 13,110.88) |
| Bill lines / refunded lines | 1,204 / 38 |
| Customers / Σ balances | 31 / Rs 151,758.00 (23 owe, 1 advance, 5 settled, 2 never used) |
| Vendors / Σ balances | 19 / Rs 1,005,616.00 (all owed; largest Rs 270,547) |
| Products / Σ stock | 2,950 / 141,992 pieces |
| Stock value at sale price / at cost | Rs 11,419,777.00 / Rs 7,192,441.92 (10 products without cost excluded) |

Phase 4 compares these per entity and per month, every bill's total, both ledgers per party, stock per product,
foreign keys (`runIntegrityChecks`), timestamps (minimum and maximum per entity), and duplicates. Any
difference fails the run.

---

## 10. Corrections made to the existing tool (2026-11-10)

`src/legacy/schema-map.ts` was written from screenshots on 2026-11-01. Against the real database, five
columns it marked optional had other names, so the tool would have skipped them without a word:

| Map said | Real column | Effect it would have had |
|---|---|---|
| `products.low_stock_unit` | `low_stock_threshold_unit` | The 3 box thresholds would have become 10–120 pieces instead of boxes |
| `products.base_unit` | `base_unit_name` | None today (all "Piece") |
| `orders.bill_gst_applied` | `bill_gst_enabled` | None today (GST is off on every bill) |
| `orders.final_amount` | `net_amount` | The total check would have relied on the payment rows |
| `vendors.products_supplied` | `products` | 1 vendor would have lost its products text |

The map now uses the real names, and **no column is optional**: if the old schema changes, the run stops
before reading. Also corrected:

- **Creation times:** `created_at` and `updated_at` of categories, products, customers and vendors are kept.
- **Line tax rate:** taken from the item (13.00 on the 3 taxed items), not from today's product.
- **Line barcode and Urdu name:** left empty, because the old sale did not record them.
- **Item discounts:** kept per line, with the bill's `item_discount_total` and the discount type read from
  the bill-level discount only.
- **Exact bill totals:** a bill must total exactly what the old app charged. Before, a 1-paisa difference was
  allowed. A bill whose payment rows do not add up to its total is a blocking finding.
- **Zero refund:** a bill with refunded items but a refunded amount of 0 is blocked. `isPositive()` in decimal.js
  counts 0 as positive, so it used to pass.
- **Refund date:** the Udhaar refund's date comes from its khata credit (Q43).
- **References:** the comments now cite Q41 and Q42 instead of Q39.
- **Unchanged:** barcodes were already trimmed before the duplicate check. `LEGACY_NAIVE_TIMESTAMPS` stays,
  although no old timestamp needs it.

The CLI, writer, validation and report were added (README.md, VALIDATION.md, ADR-048).

---

## 11. Running it safely

The full steps and the recovery table are in [README.md](README.md); the reasons in ADR-048.

- **Connections:** `LEGACY_DATABASE_URL` and `TARGET_DATABASE_URL` in this folder's git-ignored `.env`.
  The request called them `OLD_DATABASE_URL` and `NEW_DATABASE_URL`. The old side is opened read-only.
  The target should use the **direct** endpoint. Connection strings are never logged or printed.
- **One transaction:** the write is batched (500 rows by default) inside one transaction, and validated
  before COMMIT. Any error or failed check rolls everything back, so a re-run always starts clean.
- **Explicit confirmation:** `apply` needs the fingerprint of a dry run of the same old data.
- **Order of runs:**
  1. Dry run.
  2. Rehearsal into a copy (done locally on 2026-11-10, VALIDATION.md §3).
  3. Stop billing on the old system.
  4. Final dry run.
  5. `apply` into production.
  6. `verify`.
- **Keep the new database empty until then.** Data typed into the new system first makes the tool stop (§8).
- **After the run:**
  - **Categories:** the API caches the first page for up to 10 minutes, so the list can look empty until
    then, or until a category is added.
  - **Settings:** not written (Q44), so their cache is unaffected.
  - **Browsers:** reload them.
- **The old database is never written to.** Keep its last backup after cutover: it holds the FBR records,
  the loyalty points and the discount reason.

---

## 12. Owner decisions (answered 2026-11-10)

The owner chose the proposed option for all four (also recorded in FEATURES.md).

| ID | Question | Decision |
|---|---|---|
| Q41 | 20 customers have loyalty points; the new system has no loyalty feature | Not migrated (the old database keeps them) |
| Q42 | 4 khata payments (Rs 6,225, 13–22 Oct) have no payment method; the new system requires one | Record them as Cash, and list them in the report |
| Q43 | The old app did not record refund dates; reports count a refund on its own date (Q28) | The refund date is the bill's date (the Udhaar refund uses its khata credit's date) |
| Q44 | Old default Bill GST rate 18 %, new setting 0 % | Keep the new setting (0 %); the report shows the old value |
