# Migration validation

What every `apply` checks before it commits, and what `verify` checks at any time (ADR-048). A failed
**critical** check rolls the whole run back. Code: `src/verify`.

## 1. How it works

- **Old side:** computed from the raw old rows read in the run's snapshot, independently of the transforms
  (`source-facts.ts`, `source-records.ts`). Money is rounded to the paisa as the migration rounds it.
- **New side:** SQL on the new database over migrated rows only (`legacy_id` set), inside the same
  transaction as the writes (`target-facts.ts`).
- **Integrity:** the application's own checks (DATABASE.md §12), run on the new database.
- If a transform is wrong, the two sides disagree and the run is rolled back.

## 2. The checks

| Check | Old side | New side | Critical |
|---|---|---|---|
| old rows read | Rows read per table | `count(*)` per old table, same snapshot | Yes |
| count: lines, linesWithProduct | Bill items, items with a product | Order lines of migrated bills, with a product | Yes |
| count: refunds, refundLines | Bills with a refunded amount, items with a refunded quantity | Refunds and refund lines of migrated bills | Yes |
| count: stockMovements | Products with stock ≠ 0 | `MIGRATION` stock movements | Yes |
| total: sales, subtotal, discounts, productTax, billGst, refunded | Σ bill `net_amount`, `total_amount`, discounts, tax, GST, refunded | Σ `total`, `subtotal`, `discount_total`, `product_tax_total`, `bill_gst_amount`, `refunded_total` | Yes |
| total: billPayments | Σ `order_payments.amount` | Σ bill totals | Yes |
| total: customerDebits, customerCredits | Σ debit, Σ credit entries | Σ positive, Σ negative customer entries | Yes |
| total: vendorPurchases, vendorPayments | Σ purchase, Σ payment entries | Σ positive, Σ negative vendor entries | Yes |
| total: stockPieces, stockAtPrice, stockAtCost | Σ stock; Σ stock × price; Σ stock × cost (where there is a cost) | Same on products | Yes |
| by group: salesByMonth | Σ `net_amount` per Pakistan month | Σ `total` per Pakistan month | Yes |
| by group: billPaymentsByMethod | Σ payments per method | Σ bill totals per method | Warning |
| by group: vendorPaymentsByMethod | Σ vendor payments per method (empty = cash, Q42) | Same | Warning |
| records: categories | Created time (merged duplicates excluded) | Same, per `legacy_id` | Yes |
| records: products | Stock, price, cost, created time | Same | Yes |
| records: customers, vendors | Balance (Σ entries), created time | Balance, created time | Yes |
| records: orders | Bill number, total, refunded, method, customer, created time | Same | Yes |
| records: customerEntries, vendorEntries | Signed amount, created time | Same | Yes |
| integrity: Stock ledger | — | Σ movements = stock, per product | Yes |
| integrity: Customer khata, Vendor khata | — | Σ entries = balance = latest `balance_after` | Yes |
| integrity: Order arithmetic | — | Σ lines = bill subtotal, discounts and tax | Yes |
| integrity: Refund totals | — | Σ refunds = refunded total; Σ refund lines = refunded quantity | Yes |
| integrity: Bill numbers | — | No duplicates; counters at the highest number per date | Yes |

For each record check, every old record must exist exactly once in the new database, with the same values,
and no migrated record may be missing from the old data. Names are not compared, because a name longer than
the new limit is cut on purpose and reported as a finding. Times are compared to the millisecond, the new
columns' precision. Duplicates cannot exist: `legacy_id`, ids and bill numbers are unique in the new
database, and the record checks would show them as extra rows.

Payment rows split by method only warn, because the bill's own method wins (MAPPING.md §5.6). Their total is
critical, and a bill whose payments do not add up to its total is a blocking finding in the dry run.

## 3. Results

### 2026-11-10: rehearsal with the real old data (local copy of the new schema)

Dry run against the real old database: 5,480 rows read, 7 findings (0 blocking: 1 duplicate barcode, 2
barcodes over 64 characters, 4 payments recorded as cash), fingerprint `cdc9544c1a89`. The real new database
passed its check (empty, all migrations applied).

`apply` into a local database: **36 of 36 checks passed**, committed in about 6.5 seconds. `verify` passed
afterwards, and a second `apply` inserted 0 rows and passed again.

| Measure | Old | New |
|---|---:|---:|
| Bills / lines / refunds / refund lines | 512 / 1,204 / 24 / 38 | same |
| Net sales | Rs 484,537.40 | same |
| Discounts / product tax / refunded | Rs 15,314.00 / Rs 62.40 / Rs 14,110.88 | same |
| Customer khata: debits / credits | Rs 268,718.00 / Rs 116,960.00 | same |
| Vendor khata: purchases / payments | Rs 1,235,116.00 / Rs 229,500.00 | same |
| Stock / value at price / at cost | 141,992 pieces / Rs 11,419,777.00 / Rs 7,192,441.92 | same |

The built API was then started against that database. It listed the 512 bills, printed receipts for a
refunded Udhaar bill, a partly refunded bill and the taxed bill 1785, opened both khatas and the dashboard
(sales net of refunds: October Rs 76,079.00, November Rs 394,347.52), and scanned a migrated barcode, with no
API errors. The local copy was then deleted.

### 2026-11-10: production run into the new Neon database

The owner confirmed that the old system had stopped billing. The final dry run against the production
database gave the same fingerprint as the rehearsal (`cdc9544c1a89`, 0 blocking findings). `apply` wrote
every planned row through the direct endpoint, and **36 of 36 checks passed** before COMMIT
(at 02:12 Pakistan time). A separate `verify` afterwards also passed 36 of 36. The row counts on the new
database equal the plan: 24 categories, 2,950 products, 2,820 stock movements, 31 customers, 19 vendors,
512 bills, 1,204 lines, 24 refunds, 38 refund lines, 157 and 67 khata entries, 11 bill counters.

### Tests

| Suite | Covers |
|---|---|
| `test/dry-run.int.test.ts` (MIG-01) | Planned rows, findings and files; nothing written; the same fingerprint for the same data and a new one after a change; the old session refuses writes; a schema change stops the run |
| `test/apply.int.test.ts` (MIG-02–MIG-05) | Full run with every check passing; money, balances, dates and links; duplicate barcodes (Q35); bill counters; a second run inserts nothing; `verify` catches a changed value |
| `test/safety.int.test.ts` | No or wrong fingerprint, changed old data and a database in use are refused; a failure half way rolls everything back, and the next run completes |
| `src/**/*.test.ts` | Config and secrets, inserts, fingerprint, counters and refund dates, comparisons, transforms |
