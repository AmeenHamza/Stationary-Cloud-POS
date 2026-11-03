# Existing System Audit (discovery stage)

**Date:** 2026-10-28
**Scope:** the current "BrandWings Business Hub" stationery POS, as evidenced in this repository
**Feature inventory:** [../FEATURES.md](../FEATURES.md) (question IDs `Q*` are defined there)

---

## 1. Repository state

| Item | Found |
|---|---|
| Source code, package manifests | **None** |
| Database schema, migrations, dumps | **None** |
| Configuration, `.env`, deployment files | **None** |
| Logs, HAR files, network captures | **None** |
| Git history | Not a git repository |
| Screenshots | 46 files in `Screen Shots/` (44 unique) |

**Consequence:** the existing code cannot be audited. Polling logic, query patterns, payload sizes,
caching headers, N+1 queries and duplicate code **cannot be confirmed**. Every network statement below is
a hypothesis paired with the test that would confirm or refute it.

---

## 2. Screenshot index

`#n` is the number in `full_page_screenshot (n).webp` (`#0` has no number). `#T` is the PNG.

| # | Screen | # | Screen |
|---|---|---|---|
| 0 | Dashboard tiles | 24 | Vendor ledger |
| 1 | Products list | 25 | Vendor — make payment |
| 2 | Add product | 26 | Vendor — add purchase |
| 3 | Edit product | 27 | AI Assistant home |
| 4 | Clone product | 28 | AI — Sales Insights |
| 5 | Restock | 29 | AI — Inventory Forecast |
| 6 | Dashboard — yearly chart | 30 | AI — Purchase Recommendations |
| 7 | Dashboard — discount/GST/payments | 31 | AI — Ask Your POS |
| 8 | Dashboard — weekly, top/least sellers | 32 | AI — Business Reports |
| 9 | Categories grid | 33 | AI — Discount Advisor |
| 10 | Add category | 34 | Settings — password |
| 11 | Edit category | 35 | Settings — Groq API key |
| 12 | Category detail (13, 14 identical) | 36 | Login |
| 15 | Low Stock Alerts | 37 | Sign up |
| 16 | Order History | 38 | Terminal — product grid |
| 17 | Refund selected items | 39 | Terminal — Khata modal |
| 18 | Customers list | 40 | Terminal — Vendors modal |
| 19 | Add customer | 41 | Terminal — Refund modal |
| 20 | Customer ledger | 42 | Terminal — cart |
| 21 | Customer — receive payment | 43 | Terminal — payment |
| 22 | Vendors list | 44 | Terminal — payment with Bill GST |
| 23 | Add vendor | T | Terminal — discount dropdown, browser URL visible |

**Not captured:** receipt printing, the Expiry Alerts page, Udhaar customer selection at checkout, the
manual "Add Udhaar" form, the import dialog, order detail or reprint, the sign-up role options, a
box-unit product in the terminal, the bottom of long lists (pagination), and any staff management screen.

Many "full page" captures cover only the viewport (869 px tall), so long pages are truncated.

---

## 3. Technology inference

| Observation | Evidence | Inference | Confidence |
|---|---|---|---|
| URL `127.0.0.1:8000/terminal/` | `#T` | Local dev server; port 8000 with trailing-slash routes fits Django `runserver` (also possible: Laravel `artisan serve`, uvicorn) | Low–medium |
| Screens were captured locally | `#T` | The 6–7 GB figure comes from the deployed database | Owner (D-02) |
| Database is Neon Postgres | Owner | The old app hits Neon's 5.5 GB network-transfer limit | Owner (D-02) |
| Groq API key in Settings | `#35` | LLM calls go to Groq from the server (key stored by the app) | Medium |
| Placeholders "e.g. Beverages", "Rice, Oil, Sugar", "10 bags rice" | `#10`, `#23`, `#26` | A generic retail template adapted for stationery | Medium |
| Login subtitle "Smart Retail Solution", "Designed & developed by BrandWings" | `#36` | A product possibly sold to several shops | Q2 |

---

## 4. Network usage analysis

### 4.1 What the figure measures (owner, D-02)

The 6–7 GB is **Neon network transfer**: bytes of query results sent from the Neon Postgres database to
the old app's server. It is **not** browser traffic. Static assets, page size and compression do not count
toward it. What counts is **how many rows and columns the app reads from the database, and how often**.

Scale (arithmetic, not measurement):

- 6–7 GB ÷ 500–600 bills ≈ **10–14 MB of database results per bill**, or 200–230 MB per day.
- Saving a bill reads and writes a few kilobytes. The rest comes from reads that **don't grow with bills**:
  pages and badges that load whole tables, totals computed in app code from raw rows, and repeated queries.
- Order numbers reach `ORD-20261028-049` on one day (`#16`, `#41`), so the real monthly bill count may be
  higher than 500–600.

### 4.2 Hypotheses for database transfer, ranked

| ID | Hypothesis | Supporting evidence | Why it is expensive in Neon terms |
|---|---|---|---|
| H1 | Dashboard totals computed in app code from raw order and order-line rows | Year chart, weekly chart, top/least sellers, discount/GST/payment summaries on one page (`#0`, `#6`–`#8`) | Each dashboard load can read every order line of the year; the cost grows every day |
| H2 | Inventory tiles and the low-stock badge read the whole product table | Selling/cost value tiles; a badge on **every** admin page (`#0`, `#15`) | 2,345 full product rows per admin page view |
| H3 | The terminal reads the whole catalogue on load and possibly after each sale | "All Products" grid with instant chips and sort (`#38`) | Full product table per sale if the page reloads |
| H4 | Background refresh (polling) repeats the queries above | "LIVE DATA" badge (`#27`); dashboard figures changed between `#0` and `#6` (a Rs 570 bill; could also be a manual reload) | Multiplies H1–H3 by every refresh, even with no sales |
| H5 | Unpaginated lists and lists that load related rows per row (N+1) | No pager seen on products, low stock, customers, vendors, orders | Full tables plus one extra query per row |
| H6 | AI features read 30/45/90-day order history | `#28`–`#32` | Large reads per AI request |
| H7 | Exports read full tables | `#1`, `#15` | Occasional, but large |

Browser-side issues (asset caching, compression, bundle size) still matter for speed and mobile data, but
they **cannot** explain the Neon figure.

### 4.3 Baseline measurement plan (no source code needed)

The old code is unavailable (D-01), but the owner can collect evidence from Neon directly without sharing
any data:

1. **Neon console → Usage:** daily network transfer for the last 30 days. Compare busy and quiet days, and
   days with no sales.
2. **`pg_stat_statements`** on the old database (owner-run): the top 20 queries by total rows returned
   and by calls. The query text is normalised (no customer values) and points directly at the culprits.
3. **Idle test:** leave one admin page and one terminal open for 30 minutes without using them, and compare
   Neon transfer before and after.

Results go into `NETWORK_OPTIMIZATION.md` as the "before" column. No figures will be invented.

For the new system, the primary budget is **database bytes per bill** (Neon transfer); browser bytes per
workflow are a secondary budget.

---

## 5. Functional, integrity and security findings

| ID | Finding | Evidence | Severity | Direction for the replacement |
|---|---|---|---|---|
| R1 | Public sign-up lets the registrant choose a role | `#37` | **Critical** if Admin is selectable (Q8) | Admin-created or invited accounts only |
| R2 | Order history can be bulk-deleted before a date | `#16` | **High** — financial and tax records, FBR | No hard delete; archive (Q9) |
| R3 | Khata entries can be bulk-cleared (before a date, >3 months) | `#18`, `#22` | **High** — running balances and audit trail | Period close with carried-forward balance (Q9) |
| R4 | Purchases are amount-only and not linked to stock; restock has no cost or vendor | `#5`, `#26` | Medium — stock valuation and audit | Keep as-is unless approved; flag for decision |
| R5 | No stock reduction or adjustment with a reason | `#3`, `#5` | Medium | Adjustment with reason and audit (Q15) |
| R6 | Cashiers reach vendor khata and refunds | `#40`, `#41` | Medium | Explicit permissions (Q8) |
| R7 | Per-day order sequence across concurrent terminals | `#16` | Medium — duplicate numbers | DB-backed sequence with a unique constraint |
| R8 | Inventory value tiles look implausible (≈ Rs 1.06 bn / Rs 537 m) | `#0` | Data quality | Validate and cleanse during migration (Q19) |
| R9 | The barcode field holds free text, sometimes with prices | `#1`, `#15` | Low–medium | Separate barcode from SKU; uniqueness rules (Q16) |
| R10 | The LLM API key is stored by the app and partly shown in the UI | `#35` | Medium | Encrypted at rest; never returned to the client |
| R11 | Running on a development server | `#T` | Unknown | Confirm the production setup |
| R12 | "Today's Orders" does not match the order sequence | `#0`, `#16` | Low | Define metrics precisely (Q18) |
| R13 | Threshold wording ("falls below") differs from behaviour (≤) | `#2`, `#15` | Low | Keep ≤ and fix the wording |
| R14 | Mixed decimals in money display; US date format | `#0`, `#16` | Low | Central formatting (Q24) |

---

**Resolved by owner decisions:** R1 (admin-created accounts, D-10), R2 and R3 (archive, never delete,
D-12), R5 (admin stock adjustment, D-18), R6 (cashier permissions, D-11). R4 stays as-is by choice (D-20).
R7 is confirmed relevant: two or more counters bill at the same time (D-04).

---

## 6. Missing inputs (ordered by impact)

1. **Old database schema** (table and column names only), for the migration script (D-21, Q27).
2. **Neon evidence**: the usage graph and a `pg_stat_statements` top-20 (§4.3). Optional, but it is the only
   way to confirm the root cause without the code.
3. **Missing screens**: the receipt, Udhaar customer selection, the import dialog, a box-unit product.
4. FBR and offline billing are **out of scope** (D-03, D-05). Source code is unavailable (D-01).
