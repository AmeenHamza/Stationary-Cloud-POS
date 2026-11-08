# FEATURES.md — Existing System Feature Inventory

**Status:** Feature inventory with the owner's decisions D-01–D-26 (§1). The technical design is in the
root documents (see [CLAUDE.md](CLAUDE.md)). Nothing in the replacement is implemented yet.
**Last updated:** 2026-10-28
**Companion document:** [docs/EXISTING_SYSTEM_AUDIT.md](docs/EXISTING_SYSTEM_AUDIT.md) (audit of the old system, network hypotheses, risks)

---

## 1. Sources and confidence

**Evidence available**

- 46 image files in `Screen Shots/`. 44 are unique; `(13)` and `(14)` are byte-identical to `(12)`.
  They were captured on 2026-10-28 from an instance running at `127.0.0.1:8000`.
- The repository contains **no source code, database schema, configuration, logs or network captures**.
  Everything below comes from the screenshots alone.

**Confidence labels**

| Label | Meaning |
|---|---|
| **C** Confirmed | Directly visible in a screenshot |
| **I** Inferred | A reasonable reading of visible evidence; must be verified against code or the owner |
| **Q** Clarify | Cannot be determined; see the question ID in §6 |

**Screenshot references** use the number in the filename: `#0` = `full_page_screenshot.webp`,
`#17` = `full_page_screenshot (17).webp`, `#T` = `Screenshot 2026-10-28 222719.png`.
The full index is in the audit document, §2.

Personal data visible in the screenshots (customer and vendor names, phone numbers, staff names, a
partially masked API key) is deliberately **not** reproduced in project documentation.

### Owner decisions (answered 2026-10-28)

These override the screenshots wherever they differ. **D** = decided by the owner.

| ID | Topic | Decision |
|---|---|---|
| D-01 | Old source and database | Not available for review. Work from screenshots and these answers (Q3) |
| D-02 | 6–7 GB figure | It is **Neon database network transfer** (the old app's Postgres hit Neon's 5.5 GB limit), not browser traffic (Q4) |
| D-03 | FBR | **Not needed.** Leave FBR reporting out entirely (Q1) |
| D-04 | Setup | **One shop, 2+ counters billing at the same time.** No branches, no multi-tenancy (Q2) |
| D-05 | Offline | **Online only.** Billing pauses with a clear offline banner until the connection returns (Q21) |
| D-06 | Tax | Keep **both** the per-product tax rate and the optional per-bill GST (Q5) |
| D-07 | Product tax | **Added on top** of the selling price (price excludes tax) (Q5) |
| D-08 | Discount order | **Discount first**; taxes are charged on the discounted amount (Q5) |
| D-09 | Rounding | **Keep paisa**: amounts are stored and shown with 2 decimals; the total is not rounded to rupees (Q5) |
| D-10 | Accounts | Sign-up requires the server-side sign-up key; the registrant chooses Admin or Cashier. Admins can also create, disable and reset accounts (owner update 2026-11-01) |
| D-11 | Cashier permissions | Cashiers may refund bills, use customer khata, use vendor khata and give discounts (Q8) |
| D-12 | Old records | **Archive, never delete** bills or khata entries. Old records are hidden from default views but kept (Q9) |
| D-13 | Receipts | **80 mm thermal** printer (Q6) |
| D-14 | Refund stock | Refunded items **always** go back into stock (Q7) |
| D-15 | Udhaar sale | **Full credit only**: pick or quick-add a customer; the whole bill goes to their khata (Q10) |
| D-16 | Selling at or above stock | **Block at 0 or below; otherwise warn, then allow.** A product already at 0 or below cannot be sold. Selling more than the stock left warns and goes through, so stock may go negative and then appears on the low-stock list (Q12). Changed 2026-11-07; it was "warn, then allow" in every case |
| D-17 | Boxes | Cashier chooses Piece or Box; **each product may have its own box price** (Q11) |
| D-18 | Stock reduction | **New feature:** admin-only increase/decrease with a required reason, logged (Q15) |
| D-19 | Clone | **Keep as old:** each new barcode becomes a separate product copied from the original (Q16) |
| D-20 | Purchases | **Keep as old:** amount + description in vendor khata; restock stays separate |
| D-21 | Data migration | **Migrate everything** (products, customers, vendors, khata history, bills). The owner runs a migration script against the old Neon DB; data never leaves their control (Q20) |
| D-22 | AI Assistant | **Keep all 6 features**, built in the same phase as the main admin features (Q17) |
| D-23 | Expiry | **Drop** expiry dates and the Expiry Alerts page (Q13) |
| D-24 | Hosting | **Neon** for PostgreSQL; web on Vercel; API on a managed always-on host (Render/Railway/Fly — chosen in DECISIONS.md) |
| D-25 | Tax base | Bill GST is charged on the discounted subtotal **plus** product tax. Example: items Rs 1,000, product tax 10% = Rs 100, Bill GST 18% of Rs 1,100 = Rs 198, total Rs 1,298 |
| D-27 | Item discount | **New (owner, 2026-11-08):** besides the overall bill discount, which stays as it was, each item on a bill may have its own discount. Details in Q39 |
| D-28 | Delete | **New (owner, 2026-11-08), "safe delete":** Delete removes the row from the database, but only when no bill or khata entry depends on it; otherwise it is refused and Archive (Disable for staff) remains. Admins only. Bills and khata entries are still never deleted (D-12) |
| D-29 | Import and categories | **New (owner, 2026-11-08):** an import creates the categories its file names, first, then files each product under its category. This replaces "imports never create categories" in Q37 |

**Assumptions derived from the decisions (confirm at review)**

- **A-01** A bill discount is spread across lines in proportion to line value, and product tax is computed on each discounted line.
- **A-02** Each tax amount is rounded half-up to the paisa, per line for product tax and per bill for Bill GST.
- **A-03** Refunding an Udhaar bill reduces that customer's khata balance instead of paying out cash.
- **A-04** Migrated bills keep their original `ORD-…` numbers. New bills continue the same format.
- **A-05** Because the new system also uses Neon, **database transfer per bill** is the primary network budget, ahead of browser bytes.
- **A-06** Partial refund amounts are proportional per line (net + product tax), plus a proportional share of Bill GST. The refund that clears the last units of a line, or the whole bill, takes the exact remainder, so a full refund always equals the bill total (SYSTEM_DESIGN.md §3.2).
- **A-07** Staff accounts are recreated by the admin, not migrated (old password hashes cannot be reused safely). Migrated bills keep the cashier's name as text.
- **A-08** The Box option appears at the counter only for products that have a box price set (D-17).

### Infrastructure requirement: Redis (owner, 2026-10-28)

**D-26** Redis is **mandatory** and is integrated from the infrastructure phase. This supersedes the
original brief's "Redis only when justified". Each capability is still used only where it is justified;
not every request goes through Redis, and not every query result is cached.

| Use | Rule |
|---|---|
| Cache | Cache-aside for stable, read-heavy data (categories, settings, similar). Explicit TTLs, event-driven invalidation, stampede protection. Never authoritative for money, stock or bills; no customer PII without a justified, secure need |
| Real-time fan-out | Events reach authorised clients on any API instance via Redis Pub/Sub, or a maintained adapter for the chosen transport. Scoped per role and user; tenant/branch scoping does not apply (D-04). Never broadcast sensitive data |
| Rate limiting | Shared Redis-backed limits on authentication, sensitive operations and heavy queries. Must never block normal cashier work |
| Coordination | Distributed locks only for a specific, documented race. Never a substitute for PostgreSQL transactions, unique constraints or concurrency control |
| Background jobs | BullMQ only for genuinely asynchronous, non-critical work (e.g. exports, notifications). Idempotent, with retry, failure and retention policies. Bill creation and stock changes never run as jobs |

**Rules:** PostgreSQL is the only source of truth for products, stock, bills and payments. A Redis outage
must not lose or corrupt a sale. Pub/Sub is not durable; use a PostgreSQL transactional outbox where
durable delivery is needed. Key namespaces, TTLs, invalidation flows, memory limit and eviction policy are
documented. Redis uses authentication, private networking and TLS where available. Memory, hit ratio,
latency, evictions, connections and failures are monitored.

**Documents that must cover Redis:** ARCHITECTURE, SYSTEM_DESIGN, DATABASE, API, NETWORK_OPTIMIZATION,
IMPLEMENTATION_PLAN, TESTING, DEPLOYMENT, DECISIONS.

**Required tests:** cache invalidation; stale-data prevention; Redis connection failure; multi-instance
real-time delivery; financial correctness during cache or Redis failure.

**Settled in the design stage (DECISIONS.md):** Redis 8 on Railway's private network next to the API (ADR-022,
proposed; owner confirms as U-01). Multi-instance subscription delivery uses a Redis-backed GraphQL PubSub
for `graphql-ws` (ADR-008). Full Redis design: SYSTEM_DESIGN.md §6.

---

## 2. Roles

| Role | Evidence | Access observed |
|---|---|---|
| Admin | `#0` user label "Admin", "ADMIN PANEL" | Sidebar app: Overview, Products, Categories, Low Stock, Expiry Alerts, Orders, Customers, Vendors, AI Assistant, Settings (C) |
| Cashier | `#37` role dropdown default "Cashier"; `#38` | POS terminal plus header modals: Khata (customers), Vendors, Refund (C) |

- **C** Sign-up is public ("Need an account? Sign Up") and the registrant chooses their own role (`#36`, `#37`).
- **Q8** Which roles the dropdown offers, and whether a self-registered user can pick Admin.
- **Q8** Whether admins can use the terminal, and whether cashiers can reach any admin page.
- **C** No user/staff management screen is visible in the admin sidebar.

**Decided for the replacement (D-10, D-11, D-18):** two roles, Admin and Cashier. Sign-up requires a
server-side secret; an admin-only staff screen also creates, disables and resets accounts. Cashiers may sell, refund, discount, and use customer and
vendor khata. Everything else is admin-only: catalogue, categories, stock adjustments, dashboard, order
archive, AI Assistant, settings and staff.

---

## 3. Screen inventory

Each screen lists purpose, roles, actions, inputs/outputs, data, validations, states, real-time
relevance, pagination and backend entities. "Real-time" and "pagination" entries describe what the
**replacement** needs; existing behaviour is noted only where visible.

### 3.1 Authentication — `#36`, `#37`, `#34`

| Aspect | Detail |
|---|---|
| Purpose | Sign in, self-register, change own password, log out |
| Roles | Anonymous (login, sign-up); any signed-in user (change password, logout) |
| Inputs | Login: username, password. Sign-up: full name, username, password, role and sign-up key. Change password: current, new, confirm |
| Validations | Not visible. Needed: required fields, password policy, confirm match, unique username |
| States | Error states not captured (Q) |
| Entities | User, Role, Session |
| Note | Light/Dark theme toggle is on every screen, including login (C) |

### 3.2 Admin dashboard "Overview" — `#0`, `#6`, `#7`, `#8`

| Aspect | Detail |
|---|---|
| Purpose | Daily and year-to-date business health |
| Roles | Admin |
| Tiles (C) | Today's Sales (Rs) · Today's Orders · Total Products · Low Stock Alerts · Expiry Alerts · Total Customer Dues · Inventory Selling Value · Inventory Cost Value |
| Charts (C) | Sales Analytics for the year (monthly bars Jan–Dec, year total, current month vs same month last year) · Weekly Sales Activity (last 7 days, filter by product) · Payment Methods donut |
| Summaries (C) | Discount: today / this week / this month. GST: today / monthly / average per order. Highest Selling top 5 and Least Selling bottom 5, by units |
| Inferred formulas (I) | Customer dues = Σ customer khata balances. Selling value = Σ stock × selling price. Cost value = Σ stock × cost price |
| Real-time | Today's sales/orders, low-stock and expiry counts should update on sale/restock/refund events |
| Pagination | N/A (aggregates). The product filter must be a server-side search, not a full product list |
| Entities | Order, OrderLine, Payment, Product, CustomerLedger |
| Questions | Q18 (definitions, time zone), Q19 (implausible inventory values) |

### 3.3 Products — `#1`–`#5`

| Aspect | Detail |
|---|---|
| Purpose | Maintain the catalogue and stock |
| Roles | Admin |
| List columns (C) | Barcode, Name, Urdu name, Category, Price/Box, Unit, Stock, Low Stock Alert, Actions |
| List actions (C) | Search by name or barcode · Edit · Clone · Restock · Delete · Template · Export PDF/XLSX/CSV · Import · Add Product |
| Add form (C) `#2` | Barcode (optional) · Name English · Name Urdu (optional) · Category (default "Uncategorised") · Selling price per piece · Cost price (optional) · Tax rate % (placeholder "default 18") · Base unit (e.g. Piece) · Pieces per box ("1 = no box") · Low-stock threshold + unit · Expiry date (optional) + alert lead time (e.g. "10 days before") · Initial stock with computed "Total: N Pieces" |
| Edit form (C) `#3` | Same fields; stock is read-only with "Use the Restock button to add stock" |
| Clone (C) `#4` | Copies every attribute (price, unit, tax, etc.) to new product records, one per newly scanned barcode, each with its own stock (default 1). "Add Unit" repeats; "Done" closes |
| Restock (C) `#5` | "Add Loose Pieces" with preview "Adding / New Total". No cost, vendor or reference fields. **I**: a box-quantity input appears when pieces per box > 1 |
| Validations | Not visible. Needed: name required, price ≥ 0, pieces per box ≥ 1, unique barcode (Q16), threshold ≥ 0 |
| Data quality (C) | The barcode field holds free text in existing data (descriptive codes, some with prices) |
| Real-time | Stock and price changes must reach open terminals |
| Pagination | Required, 50 max, server-side search on name/barcode/Urdu name |
| Entities | Product, Category, StockMovement (no separate barcode table: clones stay separate products, D-19) |
| Questions | Q11, Q14, Q15, Q16 |

### 3.4 Categories — `#9`–`#12`

| Aspect | Detail |
|---|---|
| Purpose | Group products; drive terminal category chips |
| Roles | Admin (manage); cashier sees chips only |
| Grid (C) | Card per category: name, product count, View Products, + Add Product, Edit, Delete. About 22 categories exist (`#38`) |
| Form (C) | Name · Icon (emoji, optional) · Description (optional) |
| Detail (C) `#12` | Count header, + Add Product, table (adds an Expiry column; action "Manage"), per-page selector (20 shown), "Showing 1–1 of 1 products", prev/next |
| Pagination | The grid is small; the detail table needs the 50-cap contract |
| Entities | Category, Product |
| Questions | Q16 (delete behaviour, "Manage" target) |

### 3.5 Low Stock Alerts — `#15`

| Aspect | Detail |
|---|---|
| Purpose | List products at or below their threshold |
| Columns (C) | Barcode, Product Name, Current Stock, Alert Threshold, Status ("Out of Stock" / "Low Stock") |
| Actions (C) | Refresh (manual), CSV, PDF |
| Rule (C, from data) | Low stock when stock **≤** threshold (5 of 5 and 1 of 1 are flagged). Out of stock at 0. The add form says "falls below", which does not match |
| Badge (C) | Sidebar count (314) on every admin page |
| Real-time | Badge and list should update on stock events, not by refresh or polling |
| Pagination | Required (314 rows at the time of capture) |
| Entities | Product (stock, threshold) |

### 3.6 Expiry Alerts — sidebar only

- **C** The menu item exists and the dashboard tile shows 0. The page itself was not captured.
- **D-23: dropped.** Expiry fields, the dashboard tile and this page are not rebuilt.

### 3.7 Order History (admin) — `#16`, `#17`

| Aspect | Detail |
|---|---|
| Purpose | Review sales, refund, purge old history |
| Columns (C) | Order #, Date & Time, Subtotal, Discount (e.g. "−Rs 400.00 (Flat)"), GST, Total, Method, Status, FBR, Actions |
| Filters (C) | Search by order number; status dropdown ("All Statuses") |
| Order number (C) | `ORD-YYYYMMDD-NNN`. **I**: a 3-digit sequence that resets daily |
| Status (C) | COMPLETED seen; other values unknown (Q23) |
| FBR (C) | "✓ Synced" per order. **I**: invoices are reported to Pakistan's FBR. See Q1 |
| Refund All / Refund Items (C) `#17` | Net amount and already-refunded total; per line Sold, Refunded, Remaining, Refund Qty stepper; Select All Remaining; Clear; "N unit(s) selected across M item line(s)"; Refund Selected |
| Bulk delete (C) | "Delete before: <date>" + Delete, and "Delete Old History" |
| Real-time | New orders and refund status changes |
| Pagination | Required, cursor-based, newest first |
| Entities | Order, OrderLine, Refund, RefundLine (no FBR submission record: FBR dropped, D-03) |
| Questions | Q1, Q7, Q9, Q23; order detail and reprint view not captured |

### 3.8 POS terminal (cashier) — `#38`, `#42`–`#44`, `#T`

| Aspect | Detail |
|---|---|
| Purpose | Build a cart and take payment |
| Header (C) | Brand, date, Khata, Vendors, Refund, user name, theme, Logout |
| Selection (C) | "Search by name or scan barcode" · category chips (All Products + each category) · Sort ("Name (A-Z)" seen) · tiles show stock, name, price |
| Cart (C) `#42` | Line name, qty −/+, remove ×, unit price "Rs X / Piece", line total, item count, Subtotal, Proceed to Payment. Empty state: "Tap a product to add it" |
| Payment (C) `#43`, `#44`, `#T` | Order summary · Subtotal · Product Tax · Bill GST (if applied) · TOTAL · Discount: No Discount / Flat (Rs) / Percentage (%) · Bill GST checkbox with editable rate (default 18) · Methods: Cash, Card, Easypaisa, Jazzcash, Bank Transfer, Udhaar (Credit) · Grand Total · "Process Payment · Rs X" |
| Worked example (C) | Subtotal 240.00, product tax 0.00, Bill GST 18% = 43.20, total 283.20 |
| Not captured | Receipt printing, success state, Udhaar customer selection, box vs piece selling, insufficient-stock handling |
| Decided | 80 mm receipt (D-13) · Piece/Box choice with own box price (D-17) · no sale at 0 or below, warn-then-allow above stock (D-16) · Udhaar = full credit to a picked or quick-added customer (D-15) · offline banner, no offline billing (D-05) |
| Real-time | Stock shown on tiles; price and catalogue changes |
| Pagination | The product grid must be server-searched and paged (50 max), never the full catalogue |
| Entities | Product, Order, OrderLine, Payment, CustomerLedger |
| Questions | Q5, Q6, Q10, Q11, Q12, Q21, Q22 |

**Terminal modals (C)**

- Khata `#39`: customer search, Add Customer, Open Khata. There is no Delete here, unlike the admin page.
- Vendors `#40`: vendor search, Add Vendor, Open Khata.
- Refund `#41`: order search, Refund All, Items… (the same partial-refund flow as `#17`).

### 3.9 Customers — Khata (Udhaar ledger) — `#18`–`#21`

| Aspect | Detail |
|---|---|
| Purpose | Track goods sold on credit and repayments |
| List (C) | Name, Phone, Address, Balance ("Rs N owed"), Open Khata, Delete; search by name or phone |
| Add (C) `#19` | Name, Phone, Email (optional), Address (optional) |
| Bulk clear (C) | "Clear before <date>" + Delete, and a ">3mo" shortcut |
| Ledger (C) `#20` | Header with Edit, phone, Outstanding Balance; "+ Add Udhaar (Goods on Credit)"; "− Receive Payment"; rows Date, Type, Description, Amount, running Balance; paginated |
| Credit sale link (C) | Udhaar rows reference the order ("Order ORD-…") |
| Receive payment (C) `#21` | Amount, method (Cash default), Note (optional) |
| Pagination | List and ledger, 50 max |
| Entities | Customer, CustomerLedgerEntry, Order |
| Questions | Q9, Q10, Q25 (manual Udhaar form not captured) |

### 3.10 Vendors — Supplier Khata — `#22`–`#26`

| Aspect | Detail |
|---|---|
| Purpose | Track amounts owed to suppliers |
| List (C) | Name, Phone, Products, Balance (Due), Open Khata, Delete; search; bulk clear as for customers |
| Add (C) `#23` | Company name, Phone, Email (optional), Address (optional), Products supplied (free text) |
| Ledger (C) `#24` | "Outstanding Dues (we owe)"; "+ Add Purchase (Maal Khareeda)"; "− Make Payment / Installment"; paginated rows |
| Add purchase (C) `#26` | Amount and Description only. **Purchases are not itemised and do not change stock** |
| Payment (C) `#25` | Amount, method, Note |
| Entities | Vendor, VendorLedgerEntry |

### 3.11 AI Assistant (admin only) — `#27`–`#33`, `#35`

| Feature | Inputs (C) | Notes |
|---|---|---|
| Sales Insights | Period 7/14/30/60/90 days, language | "Analyze Sales" |
| Inventory Forecast | Language | Based on 30-day sales velocity |
| Purchase Recommendations | Language | 45-day velocity, estimated costs, priorities |
| Ask Your POS | Free-text chat, suggested prompts, Clear | Greeting claims access to live sales, inventory and orders |
| Business Reports | Daily (24h), Weekly (7d), Monthly (30d), Custom dates; language | Tagged "Print" |
| Discount Advisor | Language | "Recommendations Only — No discounts are applied automatically" |

- **C** Response languages: English, Urdu, Roman Urdu. Badges: ADMIN ONLY, LIVE DATA, 3 LANGUAGES.
- **C** Provider is Groq. The API key is entered in Settings, shown masked, and replaced with a Show toggle.
- **Q17** Model, prompts, what data leaves the system, history persistence, cost limits.

### 3.12 Settings — `#34`, `#35`

- **C** Change password; Groq API key status and replacement.
- **Q26** No business profile (shop name, NTN/STRN, receipt header, default GST) is visible.

### 3.13 Cross-cutting behaviour

| Item | Detail |
|---|---|
| Theme | Light/Dark toggle on all screens (C) |
| Currency | PKR shown as "Rs" with thousands separators. Orders use 2 decimals; dashboard tiles mix 0 and 2 decimals (C) |
| Dates | US-style `M/D/YYYY, h:mm:ss AM/PM` (C). **I**: browser-locale formatting (Q24) |
| Languages | UI in English; Urdu product names; Urdu and Roman Urdu AI output (C) |
| Exports | Products: template, PDF, XLSX, CSV, import. Low stock: CSV, PDF (C) |

---

## 4. Consolidated business rules

| ID | Rule | Conf. | Evidence |
|---|---|---|---|
| BR-01 | Stock is held in base units (pieces); boxes convert by pieces-per-box | I | `#2`, `#5` |
| BR-02 | Low stock when stock ≤ threshold; out of stock at 0 | C | `#15` |
| BR-03 | Editing a product cannot change stock; only restock adds stock | C | `#3` |
| BR-04 | Clone copies all attributes except barcode and stock | C | `#4` |
| BR-05 | Order number `ORD-YYYYMMDD-NNN` | C (format), I (daily reset) | `#16` |
| BR-06 | Discount: none, flat Rs, or percentage, per bill; each item may also have its own (D-27) | C, D-27 | `#T` |
| BR-07 | Bill GST is optional per bill, rate editable, default 18% | C | `#44` |
| BR-08 | Product tax rate is per product; the default is unclear | C/Q5 | `#2`, `#3` |
| BR-09 | Six payment methods, one per bill (split payment not seen) | C/Q10 | `#43` |
| BR-10 | An Udhaar sale posts a debit to the customer khata, referencing the order | C | `#20` |
| BR-11 | A customer payment reduces the khata balance | C | `#21` |
| BR-12 | A vendor purchase increases dues; a vendor payment reduces them | C | `#24`–`#26` |
| BR-13 | Partial refunds are tracked per line; refund qty ≤ remaining | C (UI), I (enforced) | `#17` |
| BR-14 | Each order carries an FBR sync status | C (display), I (meaning) | `#16` |
| BR-15 | AI discount advice never changes prices automatically | C | `#33` |
| BR-16 | Calculation order shown: subtotal → product tax → bill GST → total | C (display), Q5 (with discount) | `#44` |
| BR-17 | Product tax is added on top of the selling price | D-07 | Owner |
| BR-18 | The bill discount is applied before both taxes (see A-01) | D-08 | Owner |
| BR-19 | Money is kept to 2 decimals; no rounding of the final total | D-09 | Owner |
| BR-20 | Refunds always return items to stock | D-14 | Owner |
| BR-21 | A product at 0 or below cannot be sold. Selling more than the recorded stock left warns, then allows; stock may go negative | D-16 | Owner |
| BR-22 | A product may have a separate box price; selling a box deducts pieces-per-box from stock | D-17 | Owner |
| BR-23 | Bills and khata entries are archived, never deleted | D-12 | Owner |
| BR-24 | Stock decreases other than sales require an admin and a reason | D-18 | Owner |
| BR-25 | Item discounts come off first; the overall discount comes off what is left; taxes come after both | D-27, Q39 | Owner |
| BR-26 | A product, customer, vendor or staff account can be deleted only if no bill, khata entry or recorded work depends on it | D-28 | Owner |

---

## 5. Feature parity checklist

Priority: **Must** = core POS or financial; **Should** = present today, review scope; **Review** = keep, change or drop needs an owner decision.
Status for every row: **Not started**.

| ID | Feature | Conf. | Priority |
|---|---|---|---|
| F-01 | Username/password login, logout | C | Must |
| F-02 | Self sign-up with role selection and sign-up key | D-10 | Must |
| F-03 | Change own password | C | Must |
| F-04 | Admin and Cashier roles | C | Must |
| F-05 | Light/Dark theme | C | Should |
| F-06 | Dashboard tiles (8) | C | Must |
| F-07 | Dashboard charts and summaries | C | Should |
| F-08 | Product CRUD with Urdu name, unit/box, box price, tax, threshold (expiry dropped, D-23) | C/D | Must |
| F-09 | Product clone per barcode, as separate products | C/D-19 | Must |
| F-10 | Restock (pieces/boxes) | C/I | Must |
| F-11 | Product import, template, export PDF/XLSX/CSV | C | Should |
| F-12 | Category CRUD with emoji and description; category detail | C | Must |
| F-13 | Low-stock list, badge, CSV/PDF export | C | Must |
| F-14 | Expiry alerts | C (menu) | **Dropped** (D-23) |
| F-15 | Order history with search and status filter | C | Must |
| F-16 | Full and partial refunds, always restocking | C/D-14 | Must |
| F-17 | Bulk delete of order history | C | **Replaced** by archive (D-12) |
| F-18 | Terminal: search, barcode scan, category chips, sort | C | Must |
| F-19 | Cart: qty, remove, subtotal | C | Must |
| F-20 | Bill discount (flat or %) | C | Must |
| F-21 | Product tax (added on top) and optional Bill GST | C/D-06–09 | Must |
| F-22 | Six payment methods incl. Udhaar (full credit) | C/D-15 | Must |
| F-23 | Receipt printing, 80 mm thermal | D-13 | Must |
| F-24 | FBR invoice reporting and sync status | I | **Dropped** (D-03) |
| F-25 | Customer khata: CRUD, ledger, credit sales, payments | C | Must |
| F-26 | Vendor khata: CRUD, purchases (amount), payments | C/D-20 | Must |
| F-27 | Khata bulk clear by date / >3 months | C | **Replaced** by archive (D-12) |
| F-28 | Terminal modals: khata, vendors, refund | C/D-11 | Must |
| F-29 | AI: insights, forecast, purchase recs, chat, reports, discount advice | C/D-22 | Must (same phase as admin) |
| F-30 | Groq API key management (encrypted, never returned to the browser) | C/D-22 | Must |
| F-31 | **New:** admin staff management (create, disable, reset password) | D-10 | Must |
| F-32 | **New:** admin-only stock adjustment with reason and log | D-18 | Must |
| F-33 | **New:** Piece/Box choice at the counter with box price | D-17 | Must |
| F-34 | **New:** above-stock warning that still allows the sale, unless the product is already at 0 or below | D-16 | Must |
| F-35 | **New:** archive view for old bills and khata entries | D-12 | Must |
| F-36 | **New:** migration of all old data via an owner-run script | D-21 | Must |
| F-37 | **New:** connection banner; billing disabled while offline | D-05 | Must |
| F-38 | **New:** terminal product list view (Product, Stock, Price, three lists side by side, a tap on a row adds it) with a Card/List dropdown | Owner, 2026-11-08 and 2026-11-09 | Must |
| F-39 | **New:** a discount on specific items of a bill, next to the overall discount | D-27 | Must |
| F-40 | **New:** regenerate a customer's bill from their khata | Owner, 2026-11-08 | Must |
| F-41 | **New:** Delete on the products, low stock, customers, vendors and staff pages (categories already had it) | D-28 | Must |
| F-42 | **New:** imports create missing categories; exports carry each product's category | D-29 | Must |

---

## 6. Open questions

### Answered (see §1 "Owner decisions")

Q1 → D-03 · Q2 → D-04 · Q3 → D-01 · Q4 → D-02 · Q5 → D-06–D-09 · Q6 → D-13 (printer only) ·
Q7 → D-14 (stock only) · Q8 → D-10, D-11 · Q9 → D-12 · Q10 → D-15 · Q11 → D-17 · Q12 → D-16 ·
Q13 → D-23 · Q15 → D-18 · Q16 → D-19 (clone only) · Q17 → D-22 (scope only) · Q20 → D-21 · Q21 → D-05

### Still open (they do not block the architecture; defaults apply unless the owner says otherwise)

| ID | Question | Proposed default |
|---|---|---|
| Q6b | Receipt content and reprints | Shop name/address/phone, bill no., date, cashier, lines, discount, taxes, total, method; reprint from order history |
| Q7b | Refund money and limits | Refund by the original method; Udhaar refunds credit the khata (A-03); reason optional; no time limit |
| Q10b | Split payments, cash tendered and change | One method per bill as today; optional "cash received → change" display |
| Q14 | Import template columns; insert versus update | Match by barcode: update if found, insert if not; row-level error report |
| Q16b | Product and category delete; barcode uniqueness | Products on past bills are archived, not deleted; a product never sold can be deleted (D-28); deleting a category moves its products to Uncategorised; barcodes unique when present |
| Q17b | Data sent to Groq; key ownership | Aggregates and product names only, never customer names or phones; one shop key in Settings |
| Q18 | Dashboard definitions | Time zone Asia/Karachi; week starts Monday; highest/least selling over the last 30 days; "Today's Orders" counts completed bills, including partly refunded ones |
| Q19 | Inventory tiles show ≈ Rs 1.06 bn / Rs 537 m | Migration report lists products with implausible stock or prices for the owner to fix |
| Q22 | Barcode scan behaviour | An exact barcode match adds one unit to the cart immediately; otherwise a name search |
| Q23 | Order statuses | Completed, Partially refunded, Refunded |
| Q24 | Date and number format; Urdu UI | `DD/MM/YYYY`, 12-hour time, "Rs" with 2 decimals; English UI with Urdu product names |
| Q25 | Manual Udhaar fields; advance balances | Amount + note; advance (negative) balances allowed and shown as "advance" |
| Q26 | Business settings | Shop name, address, phone, receipt footer, default Bill GST rate |
| Q27 | Old database schema for migration | Owner runs a schema-only query (table and column names, no data) and shares the output |
| Q28 | Which period does a refund reduce? | The refund's own date (closed days never change); bill lists still show each bill's refunded amount |
| Q29 | Base unit options (old dropdown showed only "Piece") | Free-text label, default "Piece", with suggestions from existing values |
| Q30 | What the dashboard "GST Summary" includes | Product tax + Bill GST |
| Q31 | Period of the "Payment Methods" chart | Current month |
| Q32 | Empty product tax rate (old placeholder said "default 18") | 0 %, because the old dashboard shows GST Rs 0; the admin enters 18 where needed |
| Q33 | Archiving a customer or vendor with a non-zero balance | Blocked until the balance is zero |
| Q34 | Maximum lines on one bill | 100 |
| Q35 | Duplicate active barcodes found during migration | Dry-run lists them; by default the first product keeps the barcode, later ones keep it as `legacy_barcode` with an empty barcode, for the owner to fix |
| Q36 | "Least Selling" list: include products with no sales? | Only products sold in the period (net units > 0), lowest first; otherwise the list fills with never-sold items in name order. Never-sold stock is a separate question for the owner |
| Q37 | Import template columns; an unknown category in a row | Columns: Barcode, Name, Urdu name, Category, Base unit, Pieces per box, Sale price, Box price, Cost price, Tax rate %, Low stock threshold, Threshold unit, Opening stock (only Name and Sale price required). A category the shop does not have yet is created (D-29, which replaced "an unknown category fails its row"); names match ignoring case and the first spelling in the file wins; a refused row creates nothing. A barcode repeated in one file fails the later row |
| Q38 | AI defaults the old app leaves open (F-29) | Purchase recommendations use the 45-day sales rate to cover the next 30 days: `piecesFor30Days` = rate × 30 − stock, and estimated cost = that × cost price (none without a cost price). Discount advice looks at products in stock by their last 30 days of sales. The Daily report covers today, Weekly the last 7 days and Monthly the last 30 days, each ending today. Chat history is not stored. Answers are cached for 15 minutes (a "Saved answer" badge says so) |
| Q39 | How item discounts work (D-27) | Same kinds as the overall discount: flat Rs or percentage. A flat amount comes off the item's whole line, not each unit. Item discounts come off first and the overall discount applies to what is left, so its percentage or flat limit uses that amount (Rs 1,000 with 10 % off + Rs 500, then 10 % overall: 100, then 140 of the remaining 1,400, total Rs 1,260). Taxes are charged after both (D-08). Custom items can have one too. Needs `sales:discount`, like the overall discount |
| Q40 | Which bills a khata can regenerate (F-40) | Bills linked to the customer: their Udhaar bills. Cash and other bills are not linked to a customer at the counter, so they are reprinted from order history by bill number. The bill is rebuilt from what was stored, so a later price change or refund does not alter it |

**Proposed additions (not in the old app; build only if the owner agrees)**

| ID | Proposal | Why |
|---|---|---|
| P-01 | Admin "Activity log" page listing audit entries (paginated) | Audit entries are recorded anyway (security); a viewer makes them useful |
| P-02 | Per-product "Stock history" view of stock movements | Explains stock changes after adjustments (D-18) |

---

## 7. Implementation status

| Phase | Status |
|---|---|
| Discovery — audit | Done with screenshots only; see the audit document |
| Discovery — feature inventory | Updated with owner decisions D-01–D-26; open items in §6 have defaults |
| Design stage — technical documents | Written 2026-10-28; awaiting owner review |
| Implementation | IMPLEMENTATION_PLAN.md phases 1–12 and 14 done (every feature except F-36, and the network verification: about 64 MB/month at 1,500 bills). Phase 15's local part is done (security review, runbooks, backup workflow); deployment waits for U-01–U-07. Phase 13 (F-36) waits for the old schema (Q27). Per-feature status in §8 |

---

## 8. Implementation tracker

Statuses: `NOT_STARTED` · `IN_PROGRESS` · `IMPLEMENTED` · `TESTING` · `BLOCKED` · `COMPLETE`. A feature is
`COMPLETE` only after implementation, tests, compliance audit, regression run and docs are all done. Each
completed feature gets a report in `docs/progress/F-xx.md` (files changed, tests added, exact commands and
results, compliance audit, limitations). Infrastructure phases 1–6 are tracked in IMPLEMENTATION_PLAN.md §4.

| ID | Feature | Depends on | Phase | Status | Report |
|---|---|---|---|---|---|
| F-01 | Login, logout | — | 5, 6 | COMPLETE | [F-01](docs/progress/F-01.md) |
| F-02 | Sign-up with a shared key and role selection | F-04 | 5, 6 | TESTING | — |
| F-03 | Change own password | F-01 | 5, 6 | COMPLETE | [F-03](docs/progress/F-03.md) |
| F-04 | Admin and Cashier roles | F-01 | 5 | COMPLETE | [F-04](docs/progress/F-04.md) |
| F-31 | Staff management | F-01, F-04 | 5, 6 | COMPLETE | [F-31](docs/progress/F-31.md) |
| F-05 | Light/Dark theme | — | 6 | COMPLETE | [F-05](docs/progress/F-05.md) |
| F-37 | Connection banner; billing disabled offline | F-01 | 6, 9 | COMPLETE | [F-37](docs/progress/F-37.md) |
| F-12 | Categories | F-04 | 7 | COMPLETE | [F-12](docs/progress/F-12.md) |
| F-08 | Product CRUD | F-12 | 7 | COMPLETE | [F-08](docs/progress/F-08.md) |
| F-09 | Clone per barcode | F-08 | 7 | COMPLETE | [F-09](docs/progress/F-09.md) |
| F-10 | Restock | F-08 | 7 | COMPLETE | [F-10](docs/progress/F-10.md) |
| F-32 | Stock adjustment (admin) | F-08 | 7 | COMPLETE | [F-32](docs/progress/F-32.md) |
| F-13 | Low stock list, badge, export | F-08 | 7, 11 | COMPLETE | [F-13](docs/progress/F-13.md) |
| F-25 | Customer khata | F-04 | 8 | COMPLETE | [F-25](docs/progress/F-25.md) |
| F-26 | Vendor khata | F-04 | 8 | COMPLETE | [F-26](docs/progress/F-26.md) |
| F-18 | Terminal search, scan, chips, sort | F-08, F-12 | 9 | COMPLETE | [F-18](docs/progress/F-18.md) |
| F-19 | Cart | F-18 | 9 | COMPLETE | [F-19](docs/progress/F-19.md) |
| F-33 | Piece/Box with box price | F-19 | 9 | COMPLETE | [F-33](docs/progress/F-33.md) |
| F-34 | Above-stock warning, sale allowed unless already at 0 or below | F-19 | 9 | COMPLETE | [F-34](docs/progress/F-34.md) |
| F-20 | Bill discount | F-19 | 9 | COMPLETE | [F-20](docs/progress/F-20.md) |
| F-21 | Product tax + Bill GST | F-19 | 9 | COMPLETE | [F-21](docs/progress/F-21.md) |
| F-22 | Six payment methods incl. Udhaar | F-19, F-25 | 9 | COMPLETE | [F-22](docs/progress/F-22.md) |
| F-23 | Receipt printing (80 mm) | F-22 | 9 | COMPLETE | [F-23](docs/progress/F-23.md) |
| F-15 | Order history | F-22 | 9 | COMPLETE | [F-15](docs/progress/F-15.md) |
| F-16 | Full and partial refunds | F-15 | 9 | COMPLETE | [F-16](docs/progress/F-16.md) |
| F-28 | Terminal modals (khata, vendors, refund) | F-25, F-26, F-16 | 8, 9 | COMPLETE | [F-28](docs/progress/F-28.md) |
| F-35 | Archive views (bills, ledgers) | F-15, F-25, F-26 | 8, 9 | COMPLETE | [F-35](docs/progress/F-35.md) |
| F-06 | Dashboard tiles | F-15, F-25 | 10 | COMPLETE | [F-06](docs/progress/F-06.md) |
| F-07 | Dashboard charts and summaries | F-06 | 10 | COMPLETE | [F-07](docs/progress/F-07.md) |
| F-11 | Product import, template, exports | F-08 | 11 | TESTING (legacy headers added; integration pending) | [F-11](docs/progress/F-11.md) |
| F-30 | Groq key management | F-04 | 12 | COMPLETE | [F-30](docs/progress/F-30.md) |
| F-29 | AI Assistant (6 features) | F-07, F-30 | 12 | COMPLETE | [F-29](docs/progress/F-29.md) |
| F-36 | Legacy data migration | all data features, Q27 | 13 | BLOCKED (needs old schema, Q27) | — |
| F-38 | Terminal list view | F-18 | Owner update | COMPLETE | [F-38](docs/progress/F-38.md) |
| F-39 | Item discount | F-20 | Owner update | COMPLETE | [F-39](docs/progress/F-39.md) |
| F-40 | Regenerate a customer's bill | F-23, F-25 | Owner update | COMPLETE | [F-40](docs/progress/F-40.md) |
| F-41 | Delete (safe delete) | F-08, F-25, F-26, F-31 | Owner update | COMPLETE | [F-41](docs/progress/F-41.md) |
| F-42 | Imports create categories | F-11, F-12 | Owner update | COMPLETE | [F-42](docs/progress/F-42.md) |
| F-14, F-17, F-24, F-27 | Replaced or dropped (D-23, D-12, D-03) | — | — | Not applicable | — |
